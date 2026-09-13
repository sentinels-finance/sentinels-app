import { cn } from "@/lib/utils";

type AssetTileProps = {
  status: "live" | "soon";
  logo?: string;
  ticker?: string;
};

const screws = ["left-1 top-1", "right-1 top-1", "bottom-1 left-1", "bottom-1 right-1"];

export function AssetTile({ status, logo, ticker }: AssetTileProps) {
  const live = status === "live";
  return (
    <div
      className={cn(
        "relative flex w-[72px] shrink-0 items-center justify-center rounded-sm bg-plate shadow-plate",
        logo ? "h-[72px]" : "h-12",
      )}
    >
      {screws.map((pos) => (
        <img key={pos} alt="" src="/landing/screw.svg" className={cn("absolute size-[7px]", pos)} />
      ))}
      {logo ? (
        <img alt={ticker ?? ""} src={logo} className={cn("size-10 rounded-full", !live && "opacity-45")} />
      ) : (
        <span className="-mt-3 text-[11px] font-bold text-white opacity-55">{ticker}</span>
      )}
      {!live && <div className="pointer-events-none absolute inset-0 rounded-sm bg-strong-950/55" />}
      <span
        className={cn(
          "absolute bottom-0 left-0 h-3.5 w-full rounded-b-md text-center text-[8px] font-bold leading-[14px] text-white",
          live ? "bg-[rgba(22,163,74,0.9)]" : "bg-[rgba(89,97,112,0.55)]",
        )}
      >
        {live ? "LIVE" : "SOON"}
      </span>
    </div>
  );
}
