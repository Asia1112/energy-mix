import { Router, type Response } from "express";
import { MAX_CHARGING_HOURS, MIN_CHARGING_HOURS } from "../config/charging";
import {
  CarbonApiError,
  fetchGenerationMix
} from "../services/carbonApi.service";
import {
  getChargingWindowRange,
  getEnergyMixFetchRange,
  getEnergyMixTargetDates
} from "../services/date.service";
import {
  calculateDailyAverages,
  findBestChargingWindow,
  InsufficientGenerationDataError
} from "../services/energy.service";

const router = Router();

function sendEnergyError(res: Response, error: unknown, message: string) {
  console.error(message, error);

  if (error instanceof CarbonApiError) {
    return res
      .status(502)
      .json({ message: "Carbon Intensity API is unavailable." });
  }
  if (error instanceof InsufficientGenerationDataError) {
    return res.status(503).json({ message: error.message });
  }

  return res.status(500).json({ message });
}

router.get("/energy-mix", async (req, res) => {
  try {
    const now = new Date();
    const { from, to } = getEnergyMixFetchRange(now);
    const data = await fetchGenerationMix(from, to);
    const targetDates = getEnergyMixTargetDates(now);

    const result = calculateDailyAverages(data)
      .filter((day) => targetDates.includes(day.date))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (result.length === 0) {
      throw new InsufficientGenerationDataError();
    }

    res.json(result);
  } catch (error) {
    sendEnergyError(res, error, "Failed to fetch energy mix data.");
  }
});

router.get("/charging-window", async (req, res) => {
  try {
    const hours = Number(req.query.hours);

    if (
      !Number.isInteger(hours) ||
      hours < MIN_CHARGING_HOURS ||
      hours > MAX_CHARGING_HOURS
    ) {
      return res.status(400).json({
        message: `Charging time must be a full number of hours between ${MIN_CHARGING_HOURS} and ${MAX_CHARGING_HOURS}.`
      });
    }

    const { from, to } = getChargingWindowRange();
    const rangeStart = Date.parse(from);
    const rangeEnd = Date.parse(to);
    const data = await fetchGenerationMix(from, to);
    const forecast = data.filter(
      (interval) =>
        Date.parse(interval.from) >= rangeStart &&
        Date.parse(interval.to) <= rangeEnd
    );

    res.json(findBestChargingWindow(forecast, hours));
  } catch (error) {
    sendEnergyError(res, error, "Failed to calculate charging window.");
  }
});

export default router;
