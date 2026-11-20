import { getLondonDay, moveTimeToDay } from "../../lib/reservationCalendar";

export const DURATIONS = [1, 2, 3, 4, 5, 6];

type Feedback =
  | "created"
  | "removed"
  | "occupied"
  | "invalidTime"
  | "createError"
  | "cancelError"
  | "startedCancel"
  | "sessionError"
  | "tooFar";

interface ReservationState {
  selectedCharger: string;
  day: string;
  browsedDay: string | null;
  startAt: string;
  duration: number;
  feedback: Feedback | null;
}

export type ReservationFormState = Pick<
  ReservationState,
  "startAt" | "duration"
>;

export type ReservationAction =
  | { type: "charger"; id: string }
  | { type: "chooseDay"; day: string }
  | { type: "browseDay"; day: string }
  | { type: "start"; time: string }
  | { type: "duration"; hours: number }
  | { type: "prefill"; day: string; time: string; hours: number }
  | { type: "feedback"; feedback: Feedback | null };

export function initialReservationState(): ReservationState {
  return {
    selectedCharger: "",
    day: getLondonDay(new Date()),
    browsedDay: null,
    startAt: "",
    duration: 1,
    feedback: null
  };
}

export function reservationReducer(
  state: ReservationState,
  action: ReservationAction
): ReservationState {
  switch (action.type) {
    case "charger":
      return { ...state, selectedCharger: action.id, feedback: null };
    case "chooseDay":
    case "prefill":
      return {
        ...state,
        day: action.day,
        browsedDay: null,
        startAt:
          action.type === "prefill"
            ? action.time
            : moveTimeToDay(state.startAt, action.day),
        duration: action.type === "prefill" ? action.hours : state.duration,
        feedback: null
      };
    case "browseDay":
      return { ...state, browsedDay: action.day };
    case "start":
      return { ...state, startAt: action.time };
    case "duration":
      return { ...state, duration: action.hours };
    case "feedback":
      return { ...state, feedback: action.feedback };
  }
}
