import { createConfig, http, type CreateConnectorFn } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { mock } from "wagmi/connectors/mock";
import { DEV_ACCOUNTS, isLocalChain, targetChain } from "@/lib/chain";

const DEV_KEY = "sealed-ballot.dev-account";

export const devConnectorId = (index: number) => `dev-${index}`;

/** One connector per Hardhat account so the demo can switch identities in a click. */
function devAccount(index: number): CreateConnectorFn {
  const remembered = typeof window !== "undefined" && window.localStorage.getItem(DEV_KEY) === String(index);
  const base = mock({
    accounts: [DEV_ACCOUNTS[index]],
    features: { defaultConnected: remembered, reconnect: true },
  });
  return (config) => {
    const connector = base(config);
    return {
      ...connector,
      id: devConnectorId(index),
      name: index === 0 ? "Organiser (account #0)" : `Voter (account #${index})`,
      async connect(params) {
        window.localStorage.setItem(DEV_KEY, String(index));
        return connector.connect.call(this, params);
      },
      async disconnect() {
        if (window.localStorage.getItem(DEV_KEY) === String(index)) window.localStorage.removeItem(DEV_KEY);
        return connector.disconnect.call(this);
      },
    } as ReturnType<typeof base>;
  };
}

export function makeWagmiConfig() {
  return createConfig({
    chains: [targetChain],
    connectors: [injected(), ...(isLocalChain ? DEV_ACCOUNTS.map((_, i) => devAccount(i)) : [])],
    transports: { [targetChain.id]: http() },
    ssr: true,
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof makeWagmiConfig>;
  }
}
