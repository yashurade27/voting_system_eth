"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { DEV_ACCOUNTS, isLocalChain, targetChain } from "@/lib/chain";
import { describeError } from "@/lib/hooks";
import { shortAddress } from "@/lib/format";

const noopSubscribe = () => () => {};

export function WalletButton() {
  const { address, chainId, isConnected, connector } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!mounted) return <span className="btn btn-outline opacity-0">Connect wallet</span>;

  const wrongChain = isConnected && chainId !== targetChain.id;
  const browserWallet = connectors.find((c) => c.type === "injected");
  const devConnectors = connectors.filter((c) => c.id.startsWith("dev-"));

  return (
    <div className="relative" ref={panelRef}>
      {wrongChain ? (
        <button
          className="btn border border-flare text-flare"
          onClick={() => switchChain.mutate({ chainId: targetChain.id })}
        >
          Switch to {targetChain.name}
        </button>
      ) : (
        <button className="btn btn-outline" onClick={() => setOpen((o) => !o)}>
          {isConnected ? (
            <>
              <span className="h-2 w-2 bg-flare" />
              <span className="font-mono text-[13px]">{shortAddress(address)}</span>
            </>
          ) : (
            "Connect wallet"
          )}
        </button>
      )}

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-80 border border-ink bg-card">
          {isConnected ? (
            <div className="p-4">
              <p className="label text-graphite/60">Connected via {connector?.name}</p>
              <p className="mt-2 break-all font-mono text-sm">{address}</p>
              <p className="label mt-3 text-graphite/60">Network · {targetChain.name}</p>
              <button
                className="btn btn-outline mt-4 w-full"
                onClick={() => {
                  disconnect.mutate();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div>
              {browserWallet && (
                <button
                  className="flex w-full items-center justify-between border-b border-ink/10 px-4 py-3 text-left hover:bg-mist"
                  onClick={() => connect.mutate({ connector: browserWallet }, { onSuccess: () => setOpen(false) })}
                >
                  <span>
                    <span className="block text-sm font-medium">Browser wallet</span>
                    <span className="text-xs text-graphite/60">MetaMask, Rabby, Brave…</span>
                  </span>
                  <span className="label">→</span>
                </button>
              )}
              {isLocalChain && (
                <div className="p-4">
                  <p className="label text-graphite/60">Local demo accounts · Hardhat</p>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {devConnectors.map((c, i) => (
                      <button
                        key={c.id}
                        title={`${c.name}\n${DEV_ACCOUNTS[i]}`}
                        className={`grid h-10 place-items-center border font-mono text-sm hover:border-flare hover:text-flare ${
                          i === 0 ? "border-ink bg-ink text-card hover:bg-ink" : "border-ink/20"
                        }`}
                        onClick={() => connect.mutate({ connector: c }, { onSuccess: () => setOpen(false) })}
                      >
                        #{i}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-graphite/60">
                    #0 organises the seeded demo elections. #1–#5 are registered voters.
                  </p>
                </div>
              )}
              {connect.error && <p className="border-t border-ink/10 px-4 py-3 text-xs text-flare">{describeError(connect.error)}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
