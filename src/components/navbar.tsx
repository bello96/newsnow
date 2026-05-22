import { fixedColumnIds, metadata } from "@shared/metadata"
import { Link, useRouterState } from "@tanstack/react-router"
import { currentColumnIDAtom } from "~/atoms"

export function NavBar() {
  const currentId = useAtomValue(currentColumnIDAtom)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const onColumnRoute = !pathname.startsWith("/summary")
  return (
    <span
      className={$([
        "flex p-3 rounded-2xl bg-primary/1 text-sm",
        "shadow shadow-primary/20 hover:shadow-primary/50 transition-shadow-500",
      ])}
    >
      {fixedColumnIds.map((columnId) => (
        <Link
          key={columnId}
          to="/$column"
          params={{ column: columnId }}
          className={$(
            "px-2 hover:(bg-primary/10 rounded-md) cursor-pointer transition-all",
            onColumnRoute && currentId === columnId ? "color-primary font-bold" : "op-70 dark:op-90",
          )}
        >
          {metadata[columnId].name}
        </Link>
      ))}
      <Link
        to="/summary"
        className="px-2 hover:(bg-primary/10 rounded-md) cursor-pointer transition-all"
        inactiveProps={{ className: "op-70 dark:op-90" }}
        activeProps={{ className: "color-primary font-bold" }}
      >
        分析
      </Link>
    </span>
  )
}
