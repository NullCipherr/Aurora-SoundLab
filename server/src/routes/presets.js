import { Router } from "express";
import { categories, cinematicPresets } from "../soundLibrary.js";

export const presetsRouter = Router();

// Endpoint de leitura simples para alimentar a vitrine inicial do studio.
presetsRouter.get("/cinematic", (_, res) => {
  res.json(cinematicPresets);
});

// Categorias centralizadas para manter consistencia de filtros entre client e server.
presetsRouter.get("/categories", (_, res) => {
  res.json(categories);
});
