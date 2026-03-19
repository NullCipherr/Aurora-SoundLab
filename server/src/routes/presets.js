import { Router } from "express";
import { categories, cinematicPresets } from "../soundLibrary.js";

export const presetsRouter = Router();

presetsRouter.get("/cinematic", (_, res) => {
  res.json(cinematicPresets);
});

presetsRouter.get("/categories", (_, res) => {
  res.json(categories);
});
