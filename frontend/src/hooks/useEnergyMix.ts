import { useQuery } from "@tanstack/react-query";
import { getEnergyMix } from "../api/energyApi";
import { untilNextForecast } from "../lib/forecastFreshness";

export function useEnergyMix() {
  const query = useQuery({
    queryKey: ["energy-mix"],
    queryFn: ({ signal }) => getEnergyMix(signal),
    staleTime: untilNextForecast
  });

  return {
    energyMix: query.data ?? [],
    loading: query.isPending || (query.isFetching && !query.data),
    error: query.isError && !query.isFetching,
    retry: query.refetch
  };
}
