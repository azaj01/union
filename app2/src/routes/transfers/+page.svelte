<script lang="ts">
import {
  transferListLatestAddressQuery,
  transferListPageGtAddressQuery,
  transferListPageLtAddressQuery
} from "$lib/queries/transfer-list-address.svelte"
import { Effect, Fiber, Option } from "effect"
import { onMount } from "svelte"
import { transferCount, transferListAddress } from "$lib/stores/transfers.svelte"
import ErrorComponent from "$lib/components/model/ErrorComponent.svelte"
import Card from "$lib/components/ui/Card.svelte"
import Sections from "$lib/components/ui/Sections.svelte"
import { chains } from "$lib/stores/chains.svelte"
import { wallets } from "$lib/stores/wallets.svelte"
import NoWalletConnected from "$lib/components/NoWalletConnected.svelte"
import { settingsStore } from "$lib/stores/settings.svelte"
import TransferListItemComponent from "$lib/components/model/TransferListItemComponent.svelte"
import TransferListItemComponentSkeleton from "$lib/components/model/TransferListItemComponentSkeleton.svelte"
import TransferListPagination from "$lib/components/ui/TransferListPagination.svelte"
import WalletConnectedNoTransfers from "$lib/components/WalletConnectedNoTransfers.svelte"
import { runFork, runPromise } from "$lib/runtime";

let transferFiber: Fiber.Fiber<any, any>
let countFiber: Fiber.Fiber<any, any>
let fiberLock = false

$effect(() => {
  if (wallets.hasAnyWallet()) {
    fetchLive()
  } else {
    transferCount.data = Option.none()
  }
})

const fetchLive = async () => {
  if (fiberLock) return
  fiberLock = true
  if (transferFiber) {
    await runPromise(Fiber.interrupt(transferFiber))
  }
  if (countFiber) {
    await runPromise(Fiber.interrupt(countFiber))
  }
  const addresses = wallets.getCanonicalByteAddressList()
  if (addresses.length > 0) {
    transferFiber = runFork(
      transferListLatestAddressQuery(addresses, settingsStore.pageLimit)
    )
    // countFiber = runFork(transferCountForAddressesQuery(addresses))
  }
  fiberLock = false
}

onMount(() => {
  return async () => {
    if (transferFiber) await runPromise(Fiber.interrupt(transferFiber))
    if (countFiber) await runPromise(Fiber.interrupt(countFiber))
  }
})

const onLive = async () => {
  if (Option.isSome(transferListAddress.data) && Option.isSome(wallets.evmAddress)) {
    transferListAddress.data = Option.none()
    await runPromise(Fiber.interrupt(transferFiber))
    const addresses = wallets.getCanonicalByteAddressList()
    transferFiber = runFork(
      transferListLatestAddressQuery(addresses, settingsStore.pageLimit)
    )
    countFiber = runFork(transferCountForAddressesQuery(addresses))
  }
}

const onPrevPage = async () => {
  if (Option.isSome(transferListAddress.data)) {
    let firstSortOrder = transferListAddress.data.value.at(0)?.sort_order
    if (!firstSortOrder) return
    const addresses = wallets.getCanonicalByteAddressList()
    if (addresses.length === 0) return
    transferListAddress.data = Option.none()
    await runPromise(Fiber.interrupt(transferFiber))
    transferFiber = runFork(
      transferListPageGtAddressQuery(firstSortOrder, addresses, settingsStore.pageLimit)
    )
  }
}

const onNextPage = async () => {
  if (Option.isSome(transferListAddress.data)) {
    let lastSortOrder = transferListAddress.data.value.at(-1)?.sort_order
    if (!lastSortOrder) return
    const addresses = wallets.getCanonicalByteAddressList()
    if (addresses.length === 0) return
    transferListAddress.data = Option.none()
    await runPromise(Fiber.interrupt(transferFiber))
    transferFiber = runFork(
      transferListPageLtAddressQuery(lastSortOrder, addresses, settingsStore.pageLimit)
    )
  }
}

// TODO: reimplement
const transferCountForAddressesQuery = (_: unknown) => Effect.void
</script>

<Sections>
  <Card class="overflow-auto" divided>
    {#if Option.isSome(transferListAddress.error)}
      <ErrorComponent error={transferListAddress.error.value} />
    {/if}
    {#if Option.isSome(transferCount.error)}
      <ErrorComponent error={transferCount.error.value} />
    {/if}
    {#if wallets.getCanonicalByteAddressList().length === 0}
      <NoWalletConnected />
    {:else if Option.isSome(transferListAddress.data) && Option.isSome(chains.data)}
      {#if transferListAddress.data.value.length > 0}
        {#each transferListAddress.data.value as transfer (transfer.sort_order)}
          <TransferListItemComponent {transfer} showSeconds={false} />
        {/each}
      {:else}
        <WalletConnectedNoTransfers />
      {/if}
    {:else}
      {#each Array(settingsStore.pageLimit).fill(0)}
        <TransferListItemComponentSkeleton />
      {/each}
    {/if}
  </Card>
  <TransferListPagination
    data={transferListAddress.data}
    {onLive}
    {onPrevPage}
    {onNextPage}
  />
</Sections>
