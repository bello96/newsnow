import type { SourceID } from "@shared/types"
import { useUpdateQuery } from "./query"

export function useRefetch() {
  const updateQuery = useUpdateQuery()

  const refresh = useCallback((...sources: SourceID[]) => {
    refetchSources.clear()
    sources.forEach(id => refetchSources.add(id))
    updateQuery(...sources)
  }, [updateQuery])

  return {
    refresh,
    refetchSources,
  }
}
