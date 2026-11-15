"""High-fidelity precomputed Gale Crater / Mount Sharp briefings and evaluations for DEMO_MODE.

NASA Space Apps Challenge 2026: ROVERSE - Mars Surface Exploration Planning System.
Demo Region: Gale Crater / Mount Sharp
Demo Mission: "Boxwork Discovery Expedition"

Every value is clearly framed as:
"PROPOSED EDUCATIONAL SIMULATION (SAMPLE - replace with real data)"
"""

from __future__ import annotations

DEMO_GALE_CRATER_BRIEFING = {
    "summary": "ROVERSE Simulation: Boxwork Discovery Expedition is assessed as GO WITH CAUTION. Total supplied traverse distance is 7.2 km with a supplied duration estimate of 172 minutes (SAMPLE - replace with real data). Peak supplied slope of 14.2° occurs on Segment 1 (Base -> Boxwork Ridge); thermal duricrust provides firm traction, and supplied historical radiation (MSL RAD ~25.2 μSv/hr) is within nominal Martian surface background.",
    "risk_level": "MODERATE",
    "go_no_go": "CAUTION",
    "hazards": [
        {
            "type": "Steep Ridge Ascent (Max 14.2°)",
            "severity": "MODERATE",
            "location": "Segment 1 (Base Camp -> Mount Sharp Boxwork Ridge)",
            "source_layer": "HRSC Slope Map [SAMPLE - replace with real data]",
            "mitigation": "Traverse along northern scree ramp; maintain boot cleat engagement on resistant capstone.",
        },
        {
            "type": "Blade-Like Boxwork Vein Relief",
            "severity": "MODERATE",
            "location": "Waypoint 2 (Mount Sharp Boxwork Formation)",
            "source_layer": "HiRISE (Mars Reconnaissance Orbiter) [SAMPLE - replace with real data]",
            "mitigation": "Boxwork ridges stand 1-5m tall; navigate through eroded transverse corridors to prevent suit snagging.",
        },
        {
            "type": "Uncertain Surface Night Temperature",
            "severity": "LOW",
            "location": "Traverse-wide",
            "source_layer": "THEMIS (Mars Odyssey) [SAMPLE - replace with real data]",
            "mitigation": "THEMIS thermal inertia reflects mineral density, not a live forecast; ensure suit heating loops are verified before departure.",
        },
    ],
    "waypoints": [
      {
        "lat": -4.6821,
        "lon": 137.3812,
        "label": "Base Camp Curiosity Ridge [SAMPLE]",
        "reason": "Mission airlock departure and initial telemetry link [SAMPLE - replace with real data]."
      },
      {
        "lat": -4.6954,
        "lon": 137.3945,
        "label": "Mount Sharp Boxwork Formation [SAMPLE]",
        "reason": "Primary science target: investigate polygonal ridge networks formed by ancient subsurface groundwater [SAMPLE]."
      },
      {
        "lat": -4.7088,
        "lon": 137.4082,
        "label": "Sulfate-Clay Transition Outcrop [SAMPLE]",
        "reason": "Secondary science target: sample boundary between ancient wet clay era and evaporating sulfate era [SAMPLE]."
      },
      {
        "lat": -4.6821,
        "lon": 137.3812,
        "label": "Base Camp Return Airlock [SAMPLE]",
        "reason": "Safe return egress before reaching turn-around consumable limits [SAMPLE]."
      }
    ],
    "eva_timeline": [
      {
        "time_offset_min": 0,
        "action": "Depressurization at Base Camp Curiosity Ridge and PLSS telemetry lock.",
        "safety_checkpoint": "Suit pressure nominal at 29.6 kPa; verify primary O2 loop.",
        "consumable_status": "O2: 100% | Battery: 100%"
      },
      {
        "time_offset_min": 58,
        "action": "Complete Segment 1 ascent (2.4 km) to Boxwork Formation crest.",
        "safety_checkpoint": "Check suit gaiters; verify MRO UHF relay contact.",
        "consumable_status": "O2: 84% | Battery: 86%"
      },
      {
        "time_offset_min": 96,
        "action": "Arrive at Sulfate-Clay contact zone; core sample extraction.",
        "safety_checkpoint": "Monitor explorer heart rate on slope; verify airtight core seal.",
        "consumable_status": "O2: 72% | Battery: 76%"
      },
      {
        "time_offset_min": 115,
        "action": "MANDATORY TURN-AROUND CHECKPOINT. Begin return egress along Segment 3.",
        "safety_checkpoint": "Confirm remaining oxygen > 55%; reverse compass lock to Base Camp.",
        "consumable_status": "O2: 66% | Battery: 70%"
      },
      {
        "time_offset_min": 172,
        "action": "Arrive at Base Camp Return Airlock; initiate dust decontamination cycle.",
        "safety_checkpoint": "Airlock repressurization; sample transfer to hermetic glovebox.",
        "consumable_status": "O2: 51% | Battery: 56%"
      }
    ],
    "consumables": {
      "estimated_duration_hours": 2.87,
      "oxygen_consumed_percent": 49.0,
      "oxygen_reserve_margin_percent": 51.0,
      "battery_consumed_percent": 44.0,
      "safe_return_deadline_minutes": 115
    },
    "science_opportunities": [
      "In-situ spectroscopic survey of boxwork ridge cementation to test hydrothermal vs groundwater evaporation hypotheses.",
      "Fine-scale drilling at the sulfate-clay boundary to date the cessation of lacustrine deposition in Gale Crater.",
      "High-resolution stereoscopic imaging of wind-etched boxwork blade morphology."
    ],
    "data_gaps": [
      "Sub-meter stereo DTM is incomplete for the south-facing boxwork scarp shadow zones.",
      "Micro-scale boulder roughness under 0.25 m/pixel requires rover or astronaut visual verification."
    ],
    "data_limitations": [
      "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
      "Thermal data from THEMIS reflects orbital thermal inertia and surface density; it is NOT a live temperature forecast.",
      "Historical MSL RAD radiation measurements (~25.2 μSv/hr) do NOT establish future astronaut exposure or predict acute Solar Particle Events.",
      "All numeric distances, slopes, and durations come directly from supplied data; the AI does not calculate or verify field values."
    ],
    "confidence": 0.88,
    "simulation_notice": "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
}

DEMO_EXPLAIN_TARGET = {
    "target_id": "target-boxwork-1",
    "target_name": "Mount Sharp Boxwork Network (SAMPLE - replace with real data)",
    "geological_significance": "Boxwork structures are three-dimensional, intersecting polygonal ridges standing 1 to 5 meters in relief above surrounding bedrock (SAMPLE). They represent mineralized fracture fills formed when mineral-laden groundwater circulated through cracks in lacustrine sedimentary rocks. When wind eroded the softer mudstone host rocks over billions of years, the harder cemented fracture fills were left standing as web-like ridges.",
    "scientific_hypothesis": "The Boxwork structures in Mount Sharp record late-stage subsurface hydrological activity that persisted after the main Gale Crater paleolake dried up. Testing whether the cementation is composed of magnesium sulfates, silica, or carbonates will reveal the chemical evolution and habitability potential of ancient Martian groundwater.",
    "sampling_recommendations": [
      "Sample both the cemented ridge blade and the adjacent softer host mudstone to compare mineralogy.",
      "Use in-situ alpha-particle X-ray spectrometry (APXS) and Raman spectroscopy to detect hydrated minerals.",
      "Examine cross-cutting vein relationships to reconstruct the chronological fracturing sequence."
    ],
    "source_layer_citations": [
      "HiRISE (Mars Reconnaissance Orbiter) [SAMPLE - replace with real data]",
      "CRISM (Mars Reconnaissance Orbiter) [SAMPLE - replace with real data]",
      "HRSC DTM (Mars Express) [SAMPLE - replace with real data]"
    ],
    "data_limitations": [
      "ROVERSE Educational Simulation: For educational exploration planning only.",
      "CRISM spectral resolution (~18 m/pixel) cannot resolve individual centimeter-scale veins; ground truth is required.",
      "All descriptions reflect supplied sample notes and educational models."
    ],
    "simulation_notice": "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
}

DEMO_TERRAIN_SUMMARY = {
    "region_overview": "Gale Crater / Mount Sharp (Aeolis Mons) hosts a 5-kilometer-tall sedimentary mound recording billions of years of Martian climate evolution. The demo area features stratified lower-mound mudstones transitioning into sulfate-bearing yardangs and protruding boxwork ridge formations.",
    "layer_summaries": {
      "optical": "HiRISE (0.25 m/px) reveals blade-like boxwork ridges with localized sand ripples and basaltic float boulders.",
      "elevation": "MOLA/HRSC shows a regional elevation ranging from -4120m at Base Camp to -4035m at the Boxwork crest.",
      "slope": "HRSC slope models indicate an average slope of 7.8° with a localized maximum of 14.2° on the Boxwork scarp.",
      "thermal": "THEMIS thermal inertia (~340 J m^-2 K^-1 s^-1/2) indicates well-consolidated duricrust and bedrock capstone rather than loose drift sand.",
      "mineralogy": "CRISM spectroscopy indicates strong hydration bands associated with polyhydrated magnesium sulfates and iron smectites.",
      "radiation": "Historical MSL RAD baseline shows nominal background cosmic ray rates of ~25.2 μSv/hr."
    },
    "terrain_roughness_and_slopes": "Moderate terrain difficulty. The 14.2° maximum slope is manageable on foot with switchbacks. Boxwork ridges create localized vertical relief (1-5m) requiring routing through natural erosional passes.",
    "environmental_considerations": "Thermal inertia indicates stable footing on cemented bedrock, though orbital thermal measurements are NOT a live temperature forecast. Historical radiation provides nominal context but cannot predict episodic solar events.",
    "source_layer_citations": [
      "HiRISE (MRO) [SAMPLE]",
      "MOLA / HRSC (MGS/MEX) [SAMPLE]",
      "THEMIS (Mars Odyssey) [SAMPLE]",
      "CRISM (MRO) [SAMPLE]",
      "RAD (MSL / Curiosity) [SAMPLE]"
    ],
    "data_limitations": [
      "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
      "Thermal data is orbital thermal inertia, not a live surface weather forecast.",
      "Historical radiation readings from rover telemetry do not predict future astronaut exposure.",
      "All metrics derive strictly from supplied sample data."
    ],
    "simulation_notice": "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
}

DEMO_ROUTE_INSIGHTS = {
    "route_name": "Boxwork Discovery Loop (SAMPLE - replace with real data)",
    "summary_of_metrics": "Supplied route totals: 7.2 km traverse distance, 170 m cumulative elevation change, 14.2° maximum slope, and 172 minutes estimated traverse duration.",
    "steep_segments": [
      "Segment 1 (Base Camp -> Mount Sharp Boxwork Ridge): Maximum supplied slope is 14.2° over 2.4 km distance with +85m elevation gain."
    ],
    "long_segments": [
      "Segment 3 (Sulfate-Clay Outcrop -> Base Camp Return): Longest segment at 3.2 km distance and 76 minutes estimated duration."
    ],
    "segment_insights": [
      {
        "segment_id": "seg-1",
        "from_to": "wp-base -> wp-boxwork",
        "distance_km": 2.4,
        "max_slope_deg": 14.2,
        "steepness_flag": True,
        "long_segment_flag": False,
        "planning_insights": "Steepest leg of the mission (+85m elevation gain). Astronauts should ascend at a steady pace to conserve metabolic reserves."
      },
      {
        "segment_id": "seg-2",
        "from_to": "wp-boxwork -> wp-contact",
        "distance_km": 1.6,
        "max_slope_deg": 8.5,
        "steepness_flag": False,
        "long_segment_flag": False,
        "planning_insights": "Gentle descent across sulfate yardangs. Optimal corridor for geological photography and observation."
      },
      {
        "segment_id": "seg-3",
        "from_to": "wp-contact -> wp-return",
        "distance_km": 3.2,
        "max_slope_deg": 11.0,
        "steepness_flag": False,
        "long_segment_flag": True,
        "planning_insights": "Longest distance leg (3.2 km). Return trip considerations are critical: explorer fatigue is highest, and turn-around limits must be respected."
      }
    ],
    "return_trip_considerations": "The return leg (Segment 3) represents 44% of total distance and 44% of estimated time. Explorer fatigue will be elevated after science operations at Waypoints 2 and 3. Downslope descent (-55m) on tired legs increases loose rock tripping hazards. A strict turn-around deadline of 115 minutes ensures 51% oxygen reserve margin remains for safety.",
    "planning_insights": [
      "Ascend Segment 1 using diagonal switchbacks to mitigate the 14.2° slope.",
      "Limit sampling stop at Boxwork Formation to 25 minutes to protect return consumable budget.",
      "Initiate return egress no later than T+115 minutes."
    ],
    "data_limitations": [
      "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
      "Segment durations and slopes are taken verbatim from supplied route data; the AI does not calculate or independently verify them.",
      "Micro-topographical obstacles (boulders <0.5m) not resolved by orbital slope maps."
    ],
    "simulation_notice": "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
}

DEMO_REPORT = {
    "mission_name": "Boxwork Discovery Expedition (SAMPLE - replace with real data)",
    "executive_summary": "ROVERSE Educational Simulation Mission Report: The Boxwork Discovery Expedition in Gale Crater / Mount Sharp is evaluated as a feasible exploration scenario (Verdict: CAUTION). The proposed 7.2 km traverse explores high-priority astrobiological and hydrogeological targets while maintaining safe life-support consumable margins.",
    "geological_context": "Mount Sharp preserves an unprecedented sedimentary record of Martian history. The Boxwork Formation represents ancient groundwater mineralization along fracture networks, while the Sulfate-Clay transition documents the drying of the crater lake.",
    "route_assessment": "The 7.2 km loop encompasses 4 ordered waypoints and 3 segments. Segment 1 encounters the maximum slope of 14.2° over 2.4 km. Segment 3 is the longest return leg at 3.2 km (76 minutes).",
    "environmental_and_hazard_evaluation": "Topographical hazards include the 14.2° Boxwork ascent and 1-5m relief boxwork blades. Thermal inertia from THEMIS (~340 units) indicates firm duricrust footing. Historical MSL RAD measurements (~25.2 μSv/hr) reflect nominal background radiation.",
    "science_target_dossier": "Target 1 (Mount Sharp Boxwork Network): hydrothermal and groundwater mineralization hypothesis. Target 2 (Sulfate-Clay Transition): geochemical boundary dating ancient lake desiccation.",
    "operational_recommendations": "Adopt switchback ascents on Segment 1; enforce a hard return-trip turn-around deadline at T+115 minutes; reserve 51% oxygen margin for contingency egress.",
    "data_limitations": [
      "ROVERSE Educational Simulation: Proposed educational simulation scenario, not certified NASA flight operations.",
      "Thermal data from THEMIS reflects orbital thermal inertia and is NOT a live temperature forecast.",
      "Historical MSL RAD measurements do NOT establish future human astronaut exposure or acute solar storm warnings.",
      "All distances, slopes, elevations, and durations are based strictly on supplied input data."
    ],
    "full_report_markdown": """# ROVERSE Mission Report: Boxwork Discovery Expedition
**NASA Space Apps Challenge 2026** — *Interplanetary Survival Guide: Martian Map*  
**Region**: Gale Crater / Mount Sharp  
**Status**: Proposed Educational Simulation (SAMPLE - replace with real data)

---

## 1. Executive Summary
The **Boxwork Discovery Expedition** is a proposed educational exploration scenario designed to investigate polygonal fracture fills and mineral transition zones on the lower slopes of Mount Sharp (Aeolis Mons) in Gale Crater. 

- **Traverse Distance (Supplied)**: 7.2 km
- **Estimated Duration (Supplied)**: 172 minutes (2.87 hours)
- **Maximum Slope (Supplied)**: 14.2° (Segment 1)
- **Operational Recommendation**: **GO WITH CAUTION**

---

## 2. Geological Setting & Science Objectives
Mount Sharp preserves layered sedimentary strata deposited during Mars' transition from a wetter, potentially habitable environment to the hyper-arid planet of today.
- **Target 1: Mount Sharp Boxwork Network**: 1-5m blade-like ridges formed by mineralized groundwater circulating in fractured mudstones.
- **Target 2: Sulfate-Clay Transition Stratum**: Geochemical contact marking the evaporation of ancient Gale Crater lakes.

---

## 3. Route & Segment Analysis
1. **Segment 1 (Base Camp -> Boxwork Formation)**: 2.4 km, +85m elevation change, 14.2° max slope, 58 min. *Insight: Steepest leg; use switchbacks.*
2. **Segment 2 (Boxwork Formation -> Sulfate-Clay Contact)**: 1.6 km, -30m elevation change, 8.5° max slope, 38 min. *Insight: Gentle descent.*
3. **Segment 3 (Sulfate-Clay Contact -> Base Camp Return)**: 3.2 km, -55m elevation change, 11.0° max slope, 76 min. *Insight: Longest leg; monitor fatigue and turn-around deadline.*

---

## 4. Multi-Mission Layer Grounding & Limitations
- **Optical (HiRISE)**: Confirms boxwork ridge morphology and local sand ripples.
- **Elevation / Slope (MOLA / HRSC)**: Elev -4120m to -4035m; peak slope 14.2°.
- **Thermal (THEMIS)**: Thermal inertia ~340 units (cemented duricrust). *Caveat: Not a live temperature forecast.*
- **Mineralogy (CRISM)**: Hydrated magnesium sulfates and iron smectites.
- **Radiation (MSL RAD)**: Historical background ~25.2 μSv/hr. *Caveat: Historical measurements do not establish future astronaut biological exposure.*

---

## 5. Mandatory Simulation Notice
*This document was generated by ROVERSE as an educational simulation prototype for the NASA Space Apps Challenge 2026. It is not certified for actual human spaceflight or NASA mission control operations.*
""",
    "simulation_notice": "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
}

DEMO_CHAT_RESPONSES = {
    "default": (
        "ROVERSE Tactical Guide online. Telemetry stream locked to Gale Crater / Mount Sharp. "
        "Reviewing the 'Boxwork Discovery Expedition' (7.2 km total traverse, 172 min est. duration). "
        "HRSC slope data shows a 14.2° peak slope on Segment 1. "
        "THEMIS thermal inertia (~340 units) indicates firm cemented duricrust (note: orbital thermal data is not a live forecast). "
        "Historical MSL RAD radiation is nominal (~25.2 μSv/hr). Standing by for exploration planning queries. "
        "[Notice: Proposed educational simulation, not real NASA operations]."
    ),
    "hazards": (
        "### ROVERSE Surface Hazard Assessment [Grounded in Gale Crater Telemetry]:\n"
        "- **Slope Hazard (HRSC)**: Segment 1 features a 14.2° slope climbing +85m onto Mount Sharp. Mitigation: Follow northern scree ramp.\n"
        "- **Ridge Relief (HiRISE)**: Boxwork veins form blade-like ridges 1-5m high. Mitigation: Route through natural transverse corridors.\n"
        "- **Thermal Data Caveat (THEMIS)**: Thermal inertia indicates rocky ground, but is NOT a live temperature forecast. Prepare for extreme surface cold.\n"
        "- **Radiation Context (MSL RAD)**: Historical background is ~25.2 μSv/hr; note that historical data does NOT predict solar particle storms.\n"
        "- **Planning Status**: [CAUTION] — Observe turn-around margin at T+115 minutes.\n"
        "*(ROVERSE Educational Simulation)*"
    ),
    "budget": (
        "### ROVERSE Traverse Metrics & Consumables Summary:\n"
        "- **Supplied Total Distance**: 7.2 km round-trip\n"
        "- **Supplied Duration**: 172 minutes (2.87 hours)\n"
        "- **Reference Consumables**: ~49% oxygen capacity consumed (51% safety reserve remaining against 8.0 hr suit limit)\n"
        "- **Return-Trip Turn-Around**: Mandatory egress to Base Camp by T+115 minutes.\n"
        "- **Planning Insight**: Segment 3 is the longest leg (3.2 km, 76 min); reserve adequate power and oxygen for fatigue.\n"
        "*(Note: All metrics derived strictly from supplied route data; educational simulation only)*"
    ),
}

DEMO_ROUTE_ADVICE = {
    "recommended_route_id": "EVA-ROVERSE-01 (SAMPLE - replace with real data)",
    "routes_ranked": [
        {
            "route_id": "EVA-ROVERSE-01 (SAMPLE - replace with real data)",
            "rank": 1,
            "score_out_of_100": 91,
            "verdict": "RECOMMENDED",
            "pros": [
                "Direct corridor connecting Base Camp, Boxwork Formation, and Sulfate-Clay contact.",
                "Traverses firm duricrust confirmed by THEMIS thermal inertia (~340 units).",
                "Supplied duration of 172 minutes leaves 51% oxygen reserve margin."
            ],
            "cons": [
                "Contains a 14.2° maximum slope on Segment 1 requiring switchback footing.",
                "Segment 3 return leg is 3.2 km, requiring strict turn-around adherence."
            ],
            "hazard_summary": "14.2° slope on Boxwork ascent and 1-5m blade relief in fracture networks.",
            "recommendation_rationale": "Balances high scientific return from two major Gale Crater geological targets with safe life-support margins."
        }
    ],
    "strategic_advice": "Commander is advised to proceed with the Boxwork Discovery Loop with strict enforcement of the T+115 minute turn-around limit. Adhere to switchback trails on Segment 1.",
    "data_gaps_identified": [
      "Micro-topographical boulder density under 0.25 m/pixel requires astronaut visual confirmation."
    ],
    "data_limitations": [
      "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations.",
      "Route rankings are based strictly on supplied segment distances and slopes."
    ],
    "simulation_notice": "ROVERSE Educational Simulation: Proposed exploration scenario, not certified NASA flight operations."
}
