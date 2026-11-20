import { useQuery } from "@tanstack/react-query";
import { getChargers } from "../api/reservationApi";

export function useChargers() {
  return useQuery({
    queryKey: ["chargers"],
    queryFn: ({ signal }) => getChargers(signal),
    // Chargers come from migrations and do not change at runtime.
    staleTime: Infinity
  });
}
