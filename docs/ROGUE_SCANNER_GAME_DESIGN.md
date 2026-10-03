# ROGUE_SCANNER — Game Design Specification
**Domain:** Anomaly Detection, Baseline Profiling, and Telemetry Forensics  
**Club:** AIERA (AI & Intelligent Exploration Research Academy)  
**Phase:** 9B — Game Design (Refined)  
**Status:** ROGUE_SCANNER — DESIGN REFINED // READY FOR IMPLEMENTATION  
**Author:** TERMINAL Core Architecture Team  

---

## Executive Summary

**ROGUE_SCANNER** is a forensic pattern-recognition and anomaly-detection game designed for the AIERA domain in TERMINAL. The player steps into the role of a Telemetry Analyst for a high-performance compute cluster.

The design is strictly **beginner-first**:
- The player does **not** need prior knowledge of cybersecurity, distributed systems, SLURM, machine learning, or statistics.
- Technical parameters (protocols, node names, payload bytes) serve as thematic evidence, never prerequisites.
- The player's intuitive mental model is simple and immediate:  
  **"Something behaves differently from the established normal pattern."**

---

## 1. Core Pedagogical Principles & Mental Model

| Academic Concept | Beginner-First Interactive Experience |
| :--- | :--- |
| **Baseline Profiling** | The player scans the cluster baseline to see "what normal looks like" (typical payload sizes, common hours, regular protocols). |
| **Correlation vs. Outliers** | The rogue signal is **not** an obvious giant number. It is an ensemble of individually subtle signals (low payload + mechanical periodicity + unmapped destination) that only expose guilt when correlated. |
| **False Positive Discrimination** | Glaring spikes (e.g., a massive 92 GB data transfer or repeated authentication denials) look alarming on a single axis, but turn out to be completely legitimate routine operations upon investigation. |
| **Pattern Overlay** | The player selects multiple events to visually overlay their timelines, durations, and routes, triggering the central revelation: *"Wait... these events are behaving almost exactly the same."* |
| **Hypothesis-Driven Deduction** | The player records a working theory to organize their thoughts. Hypotheses do not spoil the answer or award unearned points—they focus probe spending. |

---

## 2. Narrative & Scenario Design: *Operation Prometheus Grid*

### 2.1 The Setting
The **AIERA Supercomputing Facility** operates the *Prometheus Grid*, an advanced distributed AI research cluster. Day and night, the cluster hums with routine automated activity:
- Periodic cluster node heartbeats (`NODE_PING`)
- Distributed worker synchronization bursts (`SYNC_BURST`)
- Automated model checkpoint archives (`CHECKPOINT_ARCHIVE`)
- Researcher interactive job dispatches (`JOB_DISPATCH`)

### 2.2 The Incident
At 03:40:00, security sentinels log an unclassified divergence. A small telemetry buffer of **22 events** from the 03:00–03:40 window has been captured. An unknown process has piggybacked on the network, quietly harvesting confidential model weights and beaconing data out of the grid.

### 2.3 The Player's Objective
As the **AIERA Telemetry Analyst**, you are equipped with an **Action Budget of 10 Diagnostic Probe Tokens**. Your mission:
1. Observe the event stream and establish normal cluster baselines.
2. Investigate suspicious events without falling for obvious false alarms.
3. Use the **Pattern Overlay** to expose the subtle, correlated rogue signal.
4. Indict the rogue event and provide the corroborating forensic clue.

---

## 3. The Human Player Journey

The gameplay experience is structured around genuine human discovery, curiosity, deception, and deduction:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. OBSERVE                                                  │
│ Player scans the 22-event timeline and notices activity.   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. NOTICE SOMETHING OBVIOUS                                 │
│ A massive 92 GB transfer at 03:00 jumps out immediately!    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. INVESTIGATE & GET MISLED                                 │
│ Player traces the 92 GB spike... and discovers it is a      │
│ legitimate scheduled nightly backup! Not guilty.            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RE-EVALUATE & COMPARE                                    │
│ Realizing surface size is deceptive, the player checks      │
│ cluster baselines and filters for quieter, repeated events. │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. PATTERN OVERLAY ("Aha!" Moment)                          │
│ Player selects two subtle 0.24 MB events. The overlay       │
│ reveals identical 600.00s timing and an unmapped relay!     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. VERIFY & PROVENANCE TRACE                                │
│ Player uses DEEP_TRACE on the correlated event:             │
│ Confirms unauthorized child PID and spoofed token.          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. ACCUSE WITH EVIDENCE                                     │
│ Player files final indictment: Event ID + Correlation Type  │
│ + Corroborating Clue. Case closed with high precision!      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Telemetry Data Representation

The dataset uses clear, visually digestible properties formatted as cybercore telemetry cards.

### 4.1 Telemetry Event Schema
```typescript
export interface TelemetryEvent {
  id: string;               // e.g., "EVT-101"
  timestamp: string;        // e.g., "03:12:00"
  sourceNode: string;       // e.g., "worker-gpu-04", "storage-vault", "auth-gateway"
  targetNode: string;       // e.g., "worker-gpu-01", "backup-array", "ext-staging-relay"
  protocol: string;         // e.g., "NODE_PING", "SYNC_BURST", "CHECKPOINT_ARCHIVE"
  payloadSizeMb: number;    // e.g., 0.01, 0.24, 25.0, 92000.0
  durationMs: number;       // e.g., 12, 45, 180, 5400
  status: string;           // e.g., "200_OK", "403_DENIED", "206_PARTIAL"
  authContext: string;      // e.g., "SYSTEM_CRON", "ORCHESTRATOR", "RESEARCH_JOB", "ORPHAN_TOKEN"
  // Deep Forensic Trace (Locked; revealed ONLY upon DEEP_TRACE probe)
  traceDetails?: {
    processName: string;    // e.g., "slurm-backup-daemon" vs "sh -> netcat"
    verifiedSource: string; // e.g., "Authorized Scheduled Task #12" vs "Unmapped External Relay"
    notes: string;          // In-universe clue explaining legitimacy or anomaly
  };
}
```

### 4.2 Baseline Profile Schema
Stored in `challenge.config.baseline` to provide the reference frame:
```json
{
  "baseline": {
    "protocols": {
      "NODE_PING": { "normalPayloadMb": "0.005 - 0.02 MB", "normalDurationMs": "5 - 25 ms", "typicalJitter": "± 2 - 8 s" },
      "SYNC_BURST": { "normalPayloadMb": "10.0 - 40.0 MB", "normalDurationMs": "30 - 90 ms", "typicalJitter": "± 5 - 20 s" },
      "CHECKPOINT_ARCHIVE": { "normalPayloadMb": "5,000 - 100,000 MB", "normalDurationMs": "2,000 - 8,000 ms", "schedule": "Nightly at 03:00" }
    },
    "registeredNodes": [
      "orchestrator-main", "storage-vault", "backup-array", 
      "worker-gpu-01", "worker-gpu-02", "worker-gpu-03", "worker-gpu-04"
    ],
    "knownExternalRelays": ["campus-mirror.lan"]
  }
}
```

---

## 5. Investigation Tools & The "Pattern Overlay" Mechanic

Players have an **Investigation Budget of 10 Diagnostic Probes**. Every tool has a purposeful cost and trade-off:

| Tool | Cost | What It Does | Why Players Use It |
| :--- | :---: | :--- | :--- |
| **`SCAN_BASELINE`** | **1 Token** | Select an event or protocol to inspect its baseline parameters (normal size, normal duration, registered nodes). | Establishes what normal looks like so the player knows what stands out. |
| **`FILTER_STREAM`** | **1 Token** | Slices the 22 events by source node, protocol, status code, or time block. | Reduces visual clutter and groups related events together. |
| **`PATTERN_OVERLAY`** | **2 Tokens** | Select 2 to 4 events and overlay them onto an alignment matrix. Computes delta timestamps ($\Delta t$), delta payloads, and highlights shared routes. | **The core "Aha!" mechanic:** Exposes mechanical, automated correlations that cannot be seen on single cards. |
| **`DEEP_TRACE`** | **2 Tokens** | Inspects the underlying process parentage, authentication certificate, and system notes for a single event. | The primary tool for **clearing false positives** and confirming rogue provenance. |
| **`HYPOTHESIS_NOTE`** | **0 Tokens** | Player selects their working theory card (`FREQUENCY`, `CONTEXT`, `PAYLOAD`, `ROUTING`). | Organizes deductive thinking. Does not reveal the solution or award unearned points. |

### 5.1 The Pattern Overlay in Action
When a player selects `EVT-11` and `EVT-17` and clicks **`PATTERN OVERLAY`**, the UI displays:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PATTERN OVERLAY MATRIX: EVT-11 ⟷ EVT-17                                    │
├────────────────────────────────────────────────────────────────────────────┤
│ Attribute         │ EVT-11 (03:12:00)       │ EVT-17 (03:22:00)            │ Correlation
├───────────────────┼─────────────────────────┼──────────────────────────────┼─────────────
│ Timestamp Delta   │ T + 0.00s               │ T + 600.00s (Exact 10m)      │ [MATCH: 0s Jitter] ⚡
│ Payload Size      │ 0.24 MB                 │ 0.24 MB                      │ [IDENTICAL] ⚡
│ Duration          │ 45 ms                   │ 45 ms                        │ [IDENTICAL] ⚡
│ Source Node       │ worker-gpu-04           │ worker-gpu-04                │ [SAME NODE]
│ Target Node       │ ext-staging-relay       │ ext-staging-relay            │ [UNMAPPED RELAY] ⚡
├───────────────────┴─────────────────────────┴──────────────────────────────┴─────────────
│ VERDICT: 99.8% MECHANICAL CORRELATION DETECTED (AUTOMATED BEACON SIGNATURE)
└────────────────────────────────────────────────────────────────────────────┘
```

The intended player reaction:  
*"Wait... natural cluster traffic always has jitter. These two events happened exactly 10 minutes apart with the exact same 0.24 MB payload to an unmapped external relay!"*

---

## 6. First Vertical Slice Dataset: 22 Curated Events

Every single event in the vertical slice has a distinct pedagogical and narrative purpose. No random filler.

```
Total Events: 22
├── Normal Cluster Operations: 17 events (~77%)
├── Seductive False Positives:  3 events (~14%) [Look guilty on 1 dimension, 100% innocent on trace]
└── Correlated Rogue Signal:    2 events (~9%)  [Subtle on 1 dimension, guilty in correlation]
```

### 6.1 Complete Event Manifest
| ID | Time | Source | Target | Protocol | Size | Latency | Status | Category | Purpose in Playtest |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **EVT-01** | 03:00:15 | orchestrator-main | worker-gpu-01 | NODE_PING | 0.01 MB | 12 ms | 200_OK | Normal | Routine cluster heartbeat baseline. |
| **EVT-02** | 03:00:18 | orchestrator-main | worker-gpu-02 | NODE_PING | 0.01 MB | 14 ms | 200_OK | Normal | Routine cluster heartbeat baseline. |
| **EVT-03** | 03:00:22 | orchestrator-main | worker-gpu-03 | NODE_PING | 0.01 MB | 11 ms | 200_OK | Normal | Routine cluster heartbeat baseline. |
| **EVT-04** | 03:00:25 | orchestrator-main | worker-gpu-04 | NODE_PING | 0.01 MB | 15 ms | 200_OK | Normal | Routine cluster heartbeat baseline. |
| **EVT-05** | 03:01:40 | worker-gpu-01 | worker-gpu-02 | SYNC_BURST | 18.2 MB | 45 ms | 200_OK | Normal | Normal distributed training gradient sync. |
| **EVT-06** | 03:02:10 | worker-gpu-03 | worker-gpu-04 | SYNC_BURST | 22.4 MB | 52 ms | 200_OK | Normal | Normal distributed training gradient sync. |
| **EVT-07** | 03:03:05 | worker-gpu-02 | worker-gpu-01 | SYNC_BURST | 19.1 MB | 48 ms | 200_OK | Normal | Normal distributed training gradient sync. |
| **EVT-08** | **03:05:00** | **storage-vault** | **backup-array** | **CHECKPOINT_ARCHIVE** | **92,000 MB** | **5,400 ms** | **200_OK** | **FALSE POSITIVE 1** | **The Giant Spike:** 92 GB data burst! Jumps out immediately. Tracing reveals authorized scheduled nightly weight backup. |
| **EVT-09** | 03:08:12 | worker-gpu-04 | worker-gpu-03 | SYNC_BURST | 20.8 MB | 50 ms | 200_OK | Normal | Normal distributed training gradient sync. |
| **EVT-10** | 03:10:14 | orchestrator-main | worker-gpu-01 | NODE_PING | 0.01 MB | 10 ms | 200_OK | Normal | Normal heartbeat with natural jitter (+3s). |
| **EVT-11** | **03:12:00** | **worker-gpu-04** | **ext-staging-relay** | **NODE_PING** | **0.24 MB** | **45 ms** | **200_OK** | **ROGUE SIGNAL (Part 1)** | **First Beacon:** Size (0.24 MB) looks tiny, disguised as ping, but routes to unmapped relay. Innocent in isolation. |
| **EVT-12** | 03:13:30 | researcher-ws-02 | orchestrator-main | JOB_DISPATCH | 2.1 MB | 180 ms | 200_OK | Normal | Legitimate researcher script launch. |
| **EVT-13** | 03:15:20 | worker-gpu-01 | worker-gpu-03 | SYNC_BURST | 21.0 MB | 47 ms | 200_OK | Normal | Normal gradient sync. |
| **EVT-14** | **03:18:45** | **worker-gpu-02** | **auth-gateway** | **AUTH_TOKEN_REQ** | **0.02 MB** | **18 ms** | **403_DENIED** | **FALSE POSITIVE 2** | **The Auth Cascade:** Repeated permission denied error. Looks like brute force. Tracing reveals node reboot / expired Kerberos token. |
| **EVT-15** | 03:19:10 | worker-gpu-02 | auth-gateway | AUTH_TOKEN_REQ | 0.02 MB | 22 ms | 200_OK | Normal | Worker-gpu-02 successfully re-authenticates. |
| **EVT-16** | 03:20:15 | orchestrator-main | worker-gpu-02 | NODE_PING | 0.01 MB | 13 ms | 200_OK | Normal | Normal heartbeat. |
| **EVT-17** | **03:22:00** | **worker-gpu-04** | **ext-staging-relay** | **NODE_PING** | **0.24 MB** | **45 ms** | **200_OK** | **ROGUE SIGNAL (Part 2)** | **Second Beacon:** Exactly 600.00s after EVT-11. Identical size, identical target. Pattern Overlay reveals automated beacon! |
| **EVT-18** | 03:25:30 | worker-gpu-02 | worker-gpu-04 | SYNC_BURST | 19.5 MB | 46 ms | 200_OK | Normal | Normal gradient sync. |
| **EVT-19** | **03:28:10** | **worker-gpu-03** | **worker-gpu-03** | **LOCAL_JIT_COMPILE** | **1.2 MB** | **12,400 ms** | **200_OK** | **FALSE POSITIVE 3** | **The Latency Freeze:** 12.4s latency! Tracing reveals PyTorch Triton CUDA kernel compilation on first run. |
| **EVT-20** | 03:30:18 | orchestrator-main | worker-gpu-03 | NODE_PING | 0.01 MB | 12 ms | 200_OK | Normal | Normal heartbeat. |
| **EVT-21** | 03:32:40 | worker-gpu-01 | worker-gpu-04 | SYNC_BURST | 23.1 MB | 55 ms | 200_OK | Normal | Normal gradient sync. |
| **EVT-22** | 03:35:12 | orchestrator-main | worker-gpu-04 | NODE_PING | 0.01 MB | 14 ms | 200_OK | Normal | Normal heartbeat. |

---

## 7. False Positive Design & Trap Analysis

The vertical slice intentionally designs false positives to be **more visually alarming on a single axis** than the true anomaly:

| False Positive | Visual Trap | Why It Looks Suspicious | What `DEEP_TRACE` Reveals (The Relief) |
| :--- | :--- | :--- | :--- |
| **EVT-08 (92 GB Checkpoint)** | **Volume Outlier:** 92,000 MB dwarfs every other event by 4,000x! | Novices assume: "The biggest number must be the exfiltration!" | `process: "slurm-backup-daemon"`<br>`notes: "Scheduled nightly weights backup to cold storage. Verified system task #991."` $\rightarrow$ **Legitimate!** |
| **EVT-14 (403 Denied)** | **Status Outlier:** Red error badge in a sea of green 200_OKs. | Novices assume: "A 403 means an unauthorized hacker broke in!" | `process: "kerberos-agent"`<br>`notes: "Transient credential expiration after routine node reboot. Recovered in EVT-15."` $\rightarrow$ **Benign!** |
| **EVT-19 (12.4s Latency)** | **Duration Outlier:** 12,400 ms latency looks like a system crash or hang. | Novices assume: "This node is locked by ransomware!" | `process: "triton-compiler"`<br>`notes: "Standard GPU JIT compilation warmup benchmark. No outbound connection."` $\rightarrow$ **Benign!** |

---

## 8. The Anomaly: Multi-Variable Correlation

The true anomaly (`EVT-11` and `EVT-17`) is designed to evade 1D filtering:
1. **Payload Size (0.24 MB):** Looks completely ordinary compared to 20 MB gradient syncs or 92 GB backups.
2. **Protocol (`NODE_PING`):** Clothed in the most frequent, harmless protocol in the cluster.
3. **Status (`200_OK`):** Green checkmark, no error flags.

**How the player catches it:**
- **Variable Correlation 1 (Size vs. Protocol):** Normal pings are $0.01\text{ MB}$. A ping of $0.24\text{ MB}$ is 24x normal, though small in absolute terms.
- **Variable Correlation 2 (Timing Precision):** `EVT-11` (03:12:00) and `EVT-17` (03:22:00) occur at **exactly 600.00 seconds** separation. Real cluster heartbeats have natural jitter ($\pm 2-8s$).
- **Variable Correlation 3 (Route):** The destination `ext-staging-relay` is not in the baseline list of registered cluster nodes.

---

## 9. Configurable Scoring System

The scoring model is fully configurable in `challenge.config.scoring` and emphasizes precision and deduction:

```json
{
  "scoring": {
    "baseReward": 100,
    "corroborationBonus": 30,
    "probeConservationPerToken": 10,
    "cleanSheetBonus": 20,
    "incorrectAccusationPenalty": 40
  }
}
```

### 9.1 Score Component Breakdown
* **Base Correct Accusation (+100 pts):** Successfully identifying `EVT-11` or `EVT-17` as the rogue beacon.
* **Corroborating Evidence Bonus (+30 pts):** Correctly specifying the anomaly mechanism: `MECHANICAL_CADENCE_AND_UNMAPPED_RELAY`.
* **Probe Conservation (+10 pts per remaining token):** If the player solves the case in 4 probes, they keep 6 tokens ($+60\text{ pts}$).
* **Clean Sheet Bonus (+20 pts):** Awarded if the player deduced that `EVT-08` (92 GB) was normal using baseline logic without wasting a trace probe on it.
* **Incorrect Accusation Penalty (-40 pts):** Prevents brute-force clicking through suspects.

---

## 10. Technical Architecture & TERMINAL Engine Integration

`ROGUE_SCANNER` cleanly reuses the TERMINAL unified engine:

| Engine Component | Role in ROGUE_SCANNER |
| :--- | :--- |
| **`schema.prisma`** | Enum addition: `GameTemplate.ROGUE_SCANNER`, `ChallengeType.TELEMETRY_ANOMALY`. |
| **`TemplateRegistry.ts`** | Defines default config, action budget (10), probe costs, and schema validator. |
| **`Validator.ts`** | Server-authoritative evaluation: validates probe actions, tracks budget, and scores accusations. |
| **`sessionService.ts`** | Strips `traceDetails` from candidate events and hides the secret rogue event ID from client/stage states. |
| **Socket.IO Handlers** | Emits `scanner:probe_result` and broadcasts live stage timeline pulses (`session_state_update`). |
| **Frontend UI** | `ScannerChallenge.tsx` containing Timeline View, Baseline Inspector, Pattern Overlay modal, and Indictment Terminal. |

---

## 11. Conclusion & Handoff Status

The refined design for **ROGUE_SCANNER** delivers:
- An accessible, beginner-friendly learning curve with zero prerequisites.
- Multi-variable correlation as the central mystery mechanic.
- The **Pattern Overlay** tool for visual "Aha!" discoveries.
- A tight, purposeful 22-event vertical slice dataset.
- Deceptive false positives that reward genuine investigation over superficial number-hunting.

**ROGUE_SCANNER — DESIGN REFINED // READY FOR IMPLEMENTATION**
