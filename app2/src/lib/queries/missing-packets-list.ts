// src/lib/queries/transfer-list-expired-window.ts
import { incompletePacketsList } from "$lib/stores/incomplete-packets.svelte"
import { fetchDecodeGraphql } from "$lib/utils/queries"
import { PacketList } from "@unionlabs/sdk/schema"
import { Effect, Option } from "effect"
import { Schema } from "effect"
import { graphql } from "gql.tada"

const missingAckDoc = graphql(`
  query MissingPackets(
        $sortOrder: String,
        $exceedingSla: String
    ) {
    v2_packets(
      args: { p_sort_order: $sortOrder, p_exceeding_sla: $exceedingSla}
    ) {
        packet_hash
        channel_version
        destination_chain_id
        destination_channel_id
        destination_universal_chain_id
        source_channel_id
        source_universal_chain_id
        packet_send_timestamp
        packet_recv_timestamp
        packet_ack_timestamp
        sort_order
        status
    }
  }
`)

/**
 * Fetch *only* those packets whose send-timestamp falls in the window
 *   [ now - 2*SLA,  now - SLA )
 * and which still have an ACK‐trace with `transaction_hash == null`.
 */
export function missingPackets(exceedingSla: string) {
  return Effect.gen(function*() {
    console.info("Fetching missing packets...")
    // XXX: sinful
    type Mutable<T> = T extends ReadonlyArray<infer U> ? U[] : T
    let cursor: string | undefined
    let found: Mutable<typeof PacketList.Type> = []

    while (true) {
      console.info("Fetching missing packets...")
      const page = yield* fetchDecodeGraphql(
        Schema.Struct({ v2_packets: PacketList }),
        missingAckDoc,
        { sortOrder: cursor ?? null, exceedingSla: exceedingSla },
      )
      const txs = page.v2_packets
      if (txs.length === 0) {
        break
      }

      found.push(...txs)

      cursor = txs?.at(-1)?.sort_order
    }

    console.info("Missing packets:", found)
    return found
  })
}

export function missingPacketListPage(exceedingSla: string) {
  incompletePacketsList.data = Option.none()
  incompletePacketsList.error = Option.none()

  return incompletePacketsList.runEffect(
    missingPackets(exceedingSla).pipe(
      Effect.tapBoth({
        onSuccess: list =>
          Effect.sync(() => {
            incompletePacketsList.data = Option.some(list)
          }),
        onFailure: err =>
          Effect.sync(() => {
            incompletePacketsList.error = Option.some(err)
          }),
      }),
    ),
  )
}
