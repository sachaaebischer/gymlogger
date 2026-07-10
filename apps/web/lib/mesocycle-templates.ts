import type { Mesocycle } from "./data-db";

function nextMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

function addWeeks(date: string, weeks: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export interface MesocycleTemplate {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  focus: string;
  toMesocycle(): Mesocycle;
}

const UPPER_LOWER_4: MesocycleTemplate = {
  id: "upper-lower-4",
  name: "Upper / Lower — 4 days",
  description: "Classic 4-day split with two upper and two lower sessions per week. Good balance of frequency and recovery.",
  daysPerWeek: 4,
  focus: "Strength & Hypertrophy",
  toMesocycle() {
    const start = nextMonday();
    return {
      name: "Upper/Lower 4-Day Block",
      goal: "Build strength and muscle with a balanced upper/lower split",
      phase: "accumulation",
      start_date: start,
      end_date: addWeeks(start, 4),
      weekly_structure: {
        monday: ["gym_upper"],
        tuesday: ["gym_lower"],
        thursday: ["gym_upper"],
        friday: ["gym_lower"],
      },
      exercises: {
        gym_upper: [
          { name: "Bench Press", sets: 4, reps: "6-8" },
          { name: "Barbell Row", sets: 4, reps: "6-8" },
          { name: "Overhead Press", sets: 3, reps: "8-10" },
          { name: "Lat Pulldown", sets: 3, reps: "10-12" },
          { name: "Dumbbell Curl", sets: 3, reps: "12-15" },
          { name: "Tricep Pushdown", sets: 3, reps: "12-15" },
        ],
        gym_lower: [
          { name: "Squat", sets: 4, reps: "6-8" },
          { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
          { name: "Leg Press", sets: 3, reps: "10-12" },
          { name: "Leg Curl", sets: 3, reps: "10-12" },
          { name: "Calf Raise", sets: 4, reps: "15-20" },
        ],
      },
    };
  },
};

const UPPER_LOWER_3: MesocycleTemplate = {
  id: "upper-lower-3",
  name: "Upper / Lower — 3 days",
  description: "3-day alternating split. Efficient schedule with good recovery — ideal if you can train Mon/Wed/Fri.",
  daysPerWeek: 3,
  focus: "General Strength",
  toMesocycle() {
    const start = nextMonday();
    return {
      name: "Upper/Lower 3-Day Block",
      goal: "Build strength with efficient 3-day schedule",
      phase: "accumulation",
      start_date: start,
      end_date: addWeeks(start, 4),
      weekly_structure: {
        monday: ["gym_upper"],
        wednesday: ["gym_lower"],
        friday: ["gym_upper"],
      },
      exercises: {
        gym_upper: [
          { name: "Bench Press", sets: 4, reps: "6-8" },
          { name: "Barbell Row", sets: 4, reps: "6-8" },
          { name: "Overhead Press", sets: 3, reps: "8-10" },
          { name: "Lat Pulldown", sets: 3, reps: "10-12" },
          { name: "Dumbbell Curl", sets: 2, reps: "12-15" },
          { name: "Tricep Extension", sets: 2, reps: "12-15" },
        ],
        gym_lower: [
          { name: "Squat", sets: 4, reps: "6-8" },
          { name: "Deadlift", sets: 3, reps: "5" },
          { name: "Leg Press", sets: 3, reps: "10-12" },
          { name: "Leg Curl", sets: 3, reps: "10-12" },
          { name: "Calf Raise", sets: 3, reps: "15-20" },
        ],
      },
    };
  },
};

const FULL_BODY_3: MesocycleTemplate = {
  id: "full-body-3",
  name: "Full Body — 3 days",
  description: "Hit everything three times a week. Great for beginners and intermediate lifters who want high frequency.",
  daysPerWeek: 3,
  focus: "Beginner / Frequency",
  toMesocycle() {
    const start = nextMonday();
    return {
      name: "Full Body 3-Day Block",
      goal: "High-frequency full-body training for strength and muscle",
      phase: "accumulation",
      start_date: start,
      end_date: addWeeks(start, 4),
      weekly_structure: {
        monday: ["gym_upper"],
        wednesday: ["gym_lower"],
        friday: ["gym_upper"],
      },
      exercises: {
        gym_upper: [
          { name: "Squat", sets: 3, reps: "5" },
          { name: "Bench Press", sets: 3, reps: "5" },
          { name: "Barbell Row", sets: 3, reps: "5" },
          { name: "Overhead Press", sets: 2, reps: "8-10" },
          { name: "Lat Pulldown", sets: 2, reps: "10-12" },
        ],
        gym_lower: [
          { name: "Deadlift", sets: 3, reps: "5" },
          { name: "Squat", sets: 3, reps: "8" },
          { name: "Romanian Deadlift", sets: 3, reps: "8-10" },
          { name: "Leg Curl", sets: 2, reps: "10-12" },
          { name: "Calf Raise", sets: 3, reps: "15" },
        ],
      },
    };
  },
};

export const TEMPLATES: MesocycleTemplate[] = [UPPER_LOWER_4, UPPER_LOWER_3, FULL_BODY_3];

export function getTemplate(id: string): MesocycleTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
