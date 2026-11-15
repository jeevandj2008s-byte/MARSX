import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
// @ts-ignore
import { plan as planEva, runScenarios as runEvaScenarios, verify as verifyEva } from './frontend/evaPlanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '1mb' }));

  app.get('/roverse-source.zip', (_req, res) => {
    const zipPath = path.join(__dirname, 'public', 'roverse-source.zip');
    res.download(zipPath, 'roverse-source.zip');
  });

  app.get('/roverse-source-extract.txt', (_req, res) => {
    const txtPath = path.join(__dirname, 'public', 'roverse-source-extract.txt');
    res.download(txtPath, 'roverse-source-extract.txt');
  });

  // -------------------------------------------------------------
  // EVA Route Planner API (Jezero Crater crewed traverse)
  // -------------------------------------------------------------
  const jezeroScenarioPath = path.join(__dirname, 'scenarios', 'jezero_reference.json');
  let jezeroScenario: any = null;
  try {
    jezeroScenario = JSON.parse(fs.readFileSync(jezeroScenarioPath, 'utf8'));
  } catch (err) {
    console.error('Failed to load jezero_reference.json:', err);
  }

  app.get('/api/eva/scenario', (_req, res) => {
    if (!jezeroScenario) {
      res.status(500).json({ error: 'Scenario not loaded' });
      return;
    }
    const { reference, ...scenarioClean } = jezeroScenario;
    res.json(scenarioClean);
  });

  app.post('/api/eva/plan', (req, res) => {
    if (!jezeroScenario) {
      res.status(500).json({ error: 'Scenario not loaded' });
      return;
    }
    const overrides = req.body || {};

    // Validate config inputs
    if (overrides.config) {
      const { tortuosity, eva_limit_min, contingency_fraction } = overrides.config;
      if (tortuosity !== undefined) {
        if (typeof tortuosity !== 'number' || !Number.isFinite(tortuosity) || tortuosity < 1.0) {
          res.status(400).json({ error: 'Invalid config: tortuosity must be >= 1.0' });
          return;
        }
      }
      if (eva_limit_min !== undefined) {
        if (typeof eva_limit_min !== 'number' || !Number.isFinite(eva_limit_min) || eva_limit_min <= 0) {
          res.status(400).json({ error: 'Invalid config: eva_limit_min must be > 0' });
          return;
        }
      }
      if (contingency_fraction !== undefined) {
        if (typeof contingency_fraction !== 'number' || !Number.isFinite(contingency_fraction) || contingency_fraction < 0) {
          res.status(400).json({ error: 'Invalid config: contingency_fraction must be >= 0' });
          return;
        }
      }
    }

    // Validate segments inputs
    if (Array.isArray(overrides.segments)) {
      for (let i = 0; i < overrides.segments.length; i++) {
        const seg = overrides.segments[i];
        if (seg && seg.speed_ms !== undefined) {
          if (typeof seg.speed_ms !== 'number' || !Number.isFinite(seg.speed_ms) || seg.speed_ms <= 0) {
            res.status(400).json({ error: `Segment ${i + 1}: speed must be > 0` });
            return;
          }
        }
      }
    }

    try {
      const result = planEva(jezeroScenario, overrides);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Plan computation error';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/eva/scenarios', (_req, res) => {
    if (!jezeroScenario) {
      res.status(500).json({ error: 'Scenario not loaded' });
      return;
    }
    try {
      const scenarios = runEvaScenarios(jezeroScenario);
      res.json(scenarios);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Scenarios computation error';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/eva/verify', (_req, res) => {
    if (!jezeroScenario) {
      res.status(500).json({ error: 'Scenario not loaded' });
      return;
    }
    try {
      const basePlan = planEva(jezeroScenario);
      const verification = verifyEva(basePlan, jezeroScenario);
      res.json(verification);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification error';
      res.status(400).json({ error: msg });
    }
  });

  app.get('/api/health', (_req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const hasConfiguredKey = Boolean(
      apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10
    );
    res.json({
      status: 'ok',
      service: 'ROVERSE Mission Telemetry & AI Briefing API',
      geminiConfigured: hasConfiguredKey,
    });
  });

  app.post('/api/mission/briefing', async (req, res) => {
    const { payload, fallbackBriefing } = req.body ?? {};
    const apiKey = process.env.GEMINI_API_KEY;
    const hasConfiguredKey = Boolean(
      apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10
    );

    if (!hasConfiguredKey) {
      res.status(200).json({
        briefing: {
          ...fallbackBriefing,
          generatedAt: new Date().toISOString(),
          sourceMode: 'deterministic-fallback',
          modelUsed: 'ROVERSE Deterministic Compiler (GEMINI_API_KEY unconfigured)',
        },
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptText = `Generate a scientific Mars surface exploration mission briefing strictly from the following ROVERSE mission telemetry JSON. Do NOT invent geological formations, mineral detections, or measurements not present in the telemetry. Explicitly state simulation assumptions and missing datasets.\n\nTELEMETRY JSON:\n${JSON.stringify(payload, null, 2)}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction:
            'You are the ROVERSE Planetary Mission Control Science Operations Officer. Produce concise, factual, technically rigorous mission briefings based strictly on the provided Mars surface telemetry. Never fabricate NASA measurements or claim astronaut safety certification.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              missionSummary: {
                type: Type.STRING,
                description: 'Concise overview of mission ID, region, route length, and duration.',
              },
              scientificObjectiveSummary: {
                type: Type.STRING,
                description: 'Summary of primary scientific objectives and selected geological targets.',
              },
              routeSummary: {
                type: Type.STRING,
                description: 'Summary of start/end coordinates, distance, and net elevation difference.',
              },
              terrainObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Segment-level elevation and slope observations.',
              },
              timeBudgetAssessment: {
                type: Type.STRING,
                description: 'Quantitative assessment of estimated duration vs available EVA budget.',
              },
              assumptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Explicit simulation assumptions (walking speed, stop duration, contingency).',
              },
              missingInformation: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Unavailable data layers and unmeasured environmental/geotechnical parameters.',
              },
              planningConsiderations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Operational and geological planning recommendations.',
              },
            },
            required: [
              'missionSummary',
              'scientificObjectiveSummary',
              'routeSummary',
              'terrainObservations',
              'timeBudgetAssessment',
              'assumptions',
              'missingInformation',
              'planningConsiderations',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText);

      res.status(200).json({
        briefing: {
          ...parsed,
          generatedAt: new Date().toISOString(),
          sourceMode: 'gemini-api',
          modelUsed: 'gemini-4-hydrogen',
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown Gemini API error';
      res.status(200).json({
        briefing: {
          ...fallbackBriefing,
          generatedAt: new Date().toISOString(),
          sourceMode: 'deterministic-fallback',
          modelUsed: 'ROVERSE Deterministic Fallback (API Error Recovery)',
        },
        warning: errMsg,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ROVERSE Mission Control server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
