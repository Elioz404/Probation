import type {
  examResultSchema,
  probationDetailSchema,
  promotionSchema,
  simulationSchema,
  trustCellSchema,
  trustEventSchema,
  workItemSchema,
} from "@shared/contracts";
import type { z } from "zod";

export type ProbationDetail = z.infer<typeof probationDetailSchema>;
export type TrustCell = z.infer<typeof trustCellSchema>;
export type Promotion = z.infer<typeof promotionSchema>;
export type Simulation = z.infer<typeof simulationSchema>;
export type TrustEvent = z.infer<typeof trustEventSchema>;
export type ExamResult = z.infer<typeof examResultSchema>;
export type WorkItem = z.infer<typeof workItemSchema>;
