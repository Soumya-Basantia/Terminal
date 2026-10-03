# SIGNAL ROUTER — MASTER GAME DESIGN SPECIFICATION

**Domain:** Graph Routing, Network Flow, Capacity Constraints, & Congestion Dynamics  
**Club:** CODENEX (Computer Science, Algorithmic Thinking, & Systems Architecture)  
**Template ID:** `SIGNAL_ROUTER`  
**Challenge Type:** `NETWORK_ROUTING`  
**Phase:** 9A — Game Design Master Document  
**Status:** GAME DESIGN COMPLETE // AWAITING IMPLEMENTATION AUTHORIZATION  
**Author:** TERMINAL Core Architecture Team  

---

## 1. Executive Summary & Design Vision

In modern software systems and network infrastructure—from internet packet switching and border gateway protocols (BGP) to cloud service meshes, content delivery networks (CDNs), and distributed microservice message queues—getting data from Origin to Destination is fundamentally a **graph routing problem under physical constraints**.

Students frequently encounter graph algorithms (Dijkstra, Bellman-Ford, Breadth-First Search, Ford-Fulkerson) as dry, textbook graph diagrams with static scalar weights ($A \to B = 5$). In these academic formulations, students memorize steps to find "the shortest path," failing to understand **why** real-world networks rarely route everything through the shortest path.

**SIGNAL ROUTER** is a tactile, real-time network flow and graph routing game. The player takes the role of a **Network Operations Center (NOC) Traffic Controller** routing critical high-volume data streams across a volatile, congested cybernetic mesh network.

The game is strictly **beginner-first**:
- The student does **not** need prior knowledge of graph theory, Dijkstra, network engineering, or routing protocols.
- The student is **never** asked: *"What is the shortest path?"* as a textbook question.
- The student's mental model is simple, intuitive, and immediate:  
  **"Get the message from here to there without overloading the network or losing the transmission."**

---

## 2. Core Pedagogical Loop & The "Aha!" Moment

```
OBSERVE NETWORK TOPOLOGY
         │
         ▼
TRACE & SELECT ROUTE
         │
         ▼
TEST / DISPATCH TRANSMISSION
         │
         ▼
OBSERVE PACKET FLOW & CONGESTION
         │
         ▼
DIAGNOSE BOTTLENECK / SATURATION
         │
         ▼
ADAPT & REROUTE TO SAFE CAPACITY
         │
         ▼
CONCEPT REVEAL (Latency vs. Throughput, Bottlenecks, Redundancy)
```

### The Core "Aha!" Moment: *"The Shortest Path Is Often a Trap"*

In almost every introductory student's mind:
$$\text{Best Route} = \text{Fewest Hops} = \text{Shortest Path}$$

**SIGNAL ROUTER** shatters this misconception within the first 60 seconds through physical causality:
1. **The Trap:** The player spots a direct 2-hop route:
   $$\text{SOURCE (TX)} \xrightarrow{15\text{ms, } 2\text{ Gbps}} \text{RELAY\_ALPHA} \xrightarrow{15\text{ms, } 2\text{ Gbps}} \text{DESTINATION (RX)}$$
   Total distance is only 2 hops. Base propagation latency is tiny: $30\text{ms}$. It appears to be the undisputed fastest route.
2. **The Crash:** The incoming payload stream requires **$4.5\text{ Gbps}$** of bandwidth. When dispatched into the 2 Gbps trunk, the link buffer saturates instantly:
   - Queue overflows.
   - Packet loss spikes to **$55\%$**.
   - Retransmission loops cause latency to blow out to $320\text{ms}$.
   - The transmission aborts due to SLA violation!
3. **The Discovery:** The player inspects an alternate 4-hop bypass route:
   $$\text{SOURCE (TX)} \xrightarrow{15\text{ms, } 10\text{ Gbps}} \text{HUB\_1} \xrightarrow{15\text{ms, } 10\text{ Gbps}} \text{HUB\_2} \xrightarrow{15\text{ms, } 10\text{ Gbps}} \text{HUB\_3} \xrightarrow{15\text{ms, } 10\text{ Gbps}} \text{DESTINATION (RX)}$$
   Even though it is 4 hops and has a higher base propagation delay ($60\text{ms}$), every link on this optical trunk has **$10\text{ Gbps}$ capacity** with zero background traffic.
4. **The "Aha!" Moment:**
   The entire $4.5\text{ Gbps}$ stream flows through smoothly at $60\text{ms}$ with **$0\%$ packet loss** and $100\%$ integrity!
   > *"The fastest-looking line can be a bottleneck. True speed depends on link capacity, queue congestion, and throughput, not just line length."*

---

## 3. Game Feel & Comparison to Existing TERMINAL Games

TERMINAL maintains strict game-feel differentiation across its signature games. `SIGNAL_ROUTER` introduces an entirely distinct topological and spatial gameplay identity:

| Game | Club | Interaction Paradigm | Core Mental Challenge | What the Player Manipulates |
| :--- | :--- | :--- | :--- | :--- |
| **Logic Heist** | CODENEX | Code block sequencing | Program state transitions & loop termination | Sequential logic blocks & variables |
| **Dead Code** | CODENEX | Bug reproduction & patch diffing | Fault isolation & regression avoidance | Stack traces, broken lines, & bug hypotheses |
| **The Witness** | LANGNET | Binary question construction | Information theory & partition tree search | Attribute queries & suspect elimination matrix |
| **Rogue Scanner** | AIERA | Telemetry filtering & pattern overlay | Multi-variable correlation & false-positive triage | Event log streams, histograms, & correlation filters |
| **Silent Mission** | AGENTIC ARC | DAG action corridor & battery allocation | Environmental state machines & causal recovery | Preconditions, postconditions, & irreversible operations |
| **SIGNAL ROUTER** | **CODENEX** | **Network graph routing & capacity steering** | **Graph flow, bottleneck avoidance, & congestion balance** | **Nodes, links, bandwidth headroom, & route corridors** |

---

## 4. The Network Model

A challenge in `SIGNAL_ROUTER` consists of an interconnected directed or undirected graph $\mathcal{G} = (\mathcal{V}, \mathcal{E})$ with physical transmission characteristics.

### 4.1 Node Types ($\mathcal{V}$)

```
[ INGRESS (TX) ] ──► ( SWITCH ) ──► [ GATEWAY ] ──► ( RELAY ) ──► [ EGRESS (RX) ]
```

| Node Type | Role & Behavior | Visual Marker |
| :--- | :--- | :--- |
| **INGRESS (`TX`)** | The origin of the transmission stream. Displays payload volume (e.g. $4.0\text{ Gbps}$) and stream type. | Solid Cyan Octagon with pulsing outward beacon |
| **EGRESS (`RX`)** | The target receiver. Must receive the required payload intact within latency and packet-loss tolerances. | Solid Emerald Octagon with target crosshair |
| **CORE ROUTER** | Standard network router node with high buffer depth and multi-interface switching. | Cyan Circle with port indicators |
| **SATELLITE / RELAY** | Lower-capacity intermediate wireless/optical hop. Low capacity, sensitive to buffer overruns. | Amber Diamond with antenna icon |
| **ENTERPRISE GATEWAY** | High-capacity traffic hub. May enforce firewall filtering, header inspection, or QoS prioritization. | Shield Hexagon with dual status rings |
| **CHOKEPOINT NODE** | A junction where multiple background streams converge. High baseline queue load. | Warning Striped Square (flashing when near saturation) |
| **COMPROMISED / UNSTABLE NODE** | A malfunctioning router with sporadic packet drops or pending link collapse. | Glitched Magenta Circle with jittering outline |

### 4.2 Link / Edge Model ($\mathcal{E}$)

Every link $e = (u, v)$ has four fundamental physical properties:

1. **Max Capacity ($C_e$):** Physical link throughput limit (e.g., $1.0\text{ Gbps}$ to $20.0\text{ Gbps}$).
2. **Background Load ($B_e$):** Existing ambient network traffic currently consuming the link (e.g., $1.5\text{ Gbps}$).
3. **Available Headroom ($H_e$):**
   $$H_e = \max(0, C_e - B_e)$$
4. **Base Propagation Latency ($L_e$):** Physical wire/fiber transit time in milliseconds (e.g., $5\text{ms}$ to $40\text{ms}$).
5. **Drop Probability / Link Noise ($P_e$):** Packet loss rate under normal conditions (typically $0.0\%$, but $5\%–15\%$ on noisy/unstable links).

### 4.3 Link Congestion & Queuing Curve

When the player routes a traffic stream of volume $V_{\text{player}}$ across link $e$, the total link utilization is:
$$U_e = B_e + V_{\text{player}}$$

The link behaves deterministically according to 3 operating regions:

```
Link Utilization:
0% ──────────── 75% ──────────── 100% ──────────────────────────► (Overload)
  [ GREEN: OPTIMAL ]  [ YELLOW: STRAINED ]  [ RED: CONGESTED & DROPPING ]
```

1. **Optimal Region ($U_e \le 0.75 \cdot C_e$):**
   - Headroom is ample.
   - Queuing delay: $0\text{ms}$.
   - Packet loss: $P_e$ (baseline).
   - Effective link latency: $L_e$.
2. **Strained Region ($0.75 \cdot C_e < U_e \le 1.0 \cdot C_e$):**
   - Link is handling the volume, but internal switch buffers are filling up.
   - Buffer Bloat Queuing Delay:
     $$D_{\text{queue}} = \left(\frac{U_e - 0.75 C_e}{0.25 C_e}\right) \times 25\text{ms}$$
   - Effective link latency: $L_e + D_{\text{queue}}$.
   - Packet loss: $P_e$ (baseline).
3. **Congested / Overflow Region ($U_e > 1.0 \cdot C_e$):**
   - Traffic exceeds physical link bandwidth. Switch buffers overflow.
   - **Packet Loss Spikes:**
     $$\text{Loss}_e = 1.0 - \left(\frac{C_e - B_e}{V_{\text{player}}}\right)$$
   - Latency jumps to maximum buffer timeout (e.g. $+150\text{ms}$).
   - The route line pulses intense red, showing discarded packets bouncing off the saturated interface.

---

## 5. Player Interface & Tactile Routing Interaction

The player interface is divided into two synchronized tactical panels:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  TERMINAL :: SIGNAL ROUTER // OPERATION FIBER_BURST                                    │
│  MISSION: Route 4.5 Gbps Telemetry Stream  |  MAX LATENCY SLA: 90ms  |  PACKET LOSS: 0%│
├─────────────────────────────────────────────────┬──────────────────────────────────────┤
│                                                 │  ROUTE TELEMETRY & WAYPOINT CORRIDOR │
│                                                 ├──────────────────────────────────────┤
│                                                 │  CURRENT PATH:                       │
│              [N1: GATEWAY]                      │  [TX] ──► [N1] ──► [N4] ──► [RX]     │
│             /             \                     │                                      │
│           (10G)           (2G)                  │  PATH METRICS:                       │
│           /                 \                   │  • Cumulative Latency: 48ms / 90ms   │
│   [TX] ───                   ───► [RX]          │  • Bottleneck Capacity: 2.0 Gbps ⚠️  │
│     \                       /                   │  • Projected Stream Load: 4.5 Gbps   │
│     (5G)                 (10G)                  │  • CONGESTION WARNING: +2.5G OVERLOAD│
│       \                 /                       │  • Projected Packet Loss: 55.5% ❌    │
│        [N2] ──(10G)── [N3]                      ├──────────────────────────────────────┤
│                                                 │  DIAGNOSTIC PROBE (3 Remaining)      │
│                                                 │  [ 📡 SEND TEST PACKET PULSE ]       │
│                                                 ├──────────────────────────────────────┤
│                                                 │  TRANSMIT:                           │
│                                                 │  [ ⚡ ENGAGE PRIMARY STREAM (4.5G) ]  │
└─────────────────────────────────────────────────┴──────────────────────────────────────┘
```

### 5.1 Interactive Topology Canvas (Left Panel)
- **Interactive Graph Rendering:**
  - Nodes rendered with crisp Cybercore iconography, displaying short name, type, and live buffer status.
  - Links rendered as bidirectional/directional conduits with live bandwidth gauges:
    `[ 7.5 / 10G ]` (Cyan text) or `[ 9.8 / 10G ]` (Flashing Amber text).
- **Tactile Route Tracing:**
  - **Click-to-Hop:** Clicking an adjacent node connects the route step.
  - **Drag-to-Trace:** Dragging the cursor from `TX` through intermediate nodes to `RX` draws the glowing signal conduit in real time.
  - **Click Node in Route to Backtrack / Splice:** Clicking any active node allows branching off to an alternate bypass node without rebuilding the entire path.

### 5.2 Waypoint Corridor & Telemetry HUD (Right Panel)
- **Waypoint Dock:**
  - Each selected node snaps into a sequential Waypoint Card:
    `[TX: SOURCE] ➔ [N1: NORTH_GATEWAY] ➔ [N4: TRANSIT_HUB] ➔ [RX: DESTINATION]`
  - Shows per-hop latency, link capacity, and current headroom.
  - The narrowest link in the selected chain is prominently badged:
    `BOTTLENECK LINK: [N1 ➔ N4] (Headroom: 2.0 Gbps)`.
- **Live Pre-Flight Telemetry:**
  - Before pressing transmit, the player sees:
    - **Total Latency:** Sum of link latencies.
    - **Headroom Margin:** `Min(H_e) - StreamVolume`.
    - **Health Forecast:** `CLEAN (0% Loss)` vs `CONGESTED (+45ms delay)` vs `CRITICAL OVERLOAD (Packet Loss Projected)`.

### 5.3 Diagnostic Probe Pulse (Anti-Blindness Tool)
- The player is equipped with **3 to 5 Diagnostic Probe Tokens**.
- Clicking **[SEND TEST PACKET PULSE]** fires a lightweight single ping packet across the currently selected path:
  - An animated luminous packet travels node-to-node across the screen.
  - As it crosses each link, the link's real-time buffer queue blinks and measures exact live latency and packet jitter.
  - This allows the player to experimentally verify link health and verify suspected congestion without committing the primary payload!

---

## 6. Multiple Valid Routing Strategies

To prevent the game from degrading into a single "one true path" riddle, every scenario provides **at least 2–3 viable, distinct routing strategies** with clear, realistic engineering trade-offs:

```
                     ┌─── [N1: DIRECT TRUNK] ───┐  (35ms, 5 Gbps, 80% Strained)
                     │                          │
[TX: INGRESS] ───────┼─── [N2: FIBER BACKBONE] ─┼───► [RX: EGRESS] (55ms, 15 Gbps, Clean)
                     │                          │
                     └─── [N3: SECURE RELAYS] ──┘  (75ms, 10 Gbps, 0% Noise, Low SLA Margin)
```

| Strategy | Path Characteristics | Latency | Bandwidth Safety | Risk Profile | Best Suited For |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Strategy A: Express Direct Route** | Fewest hops (2–3 hops). Lower capacity trunks with high background load. | Very Low ($30\text{ms}–40\text{ms}$) | Narrow ($+0.5\text{ Gbps}$ headroom) | High risk of buffer strain or sudden packet drop if background traffic fluctuates. | Time-critical emergency pings; high Speed Score bonus. |
| **Strategy B: High-Capacity Backbone Detour** | More hops (4–5 hops). Traverses high-capacity commercial/cloud fiber trunks. | Moderate ($50\text{ms}–65\text{ms}$) | Huge ($+8.0\text{ Gbps}$ headroom) | Zero congestion risk; $0\%$ packet drop guarantee; lower speed bonus. | Bulk data archives, video telemetry, heavy multi-gigabit payloads. |
| **Strategy C: Fault-Tolerant Redundant Multi-Path (Advanced)** | Traffic is split $50/50$ across two parallel links (e.g. $2.5\text{ Gbps}$ on Path North, $2.5\text{ Gbps}$ on Path South). | Balanced ($45\text{ms}–50\text{ms}$) | High (Halves the load on each branch) | Resilient against single-link failure; requires both branches to reach destination within jitter window. | Unstable networks with prone-to-failure nodes; maximizes Reliability Score. |

---

## 7. The Resource System

Rather than artificial video-game health bars or fantasy mana, `SIGNAL_ROUTER` uses **real network operational resources**:

1. **Bandwidth Headroom Budget ($\text{Gbps}$):**
   - The primary stream requires a fixed bandwidth allocation (e.g. $4.0\text{ Gbps}$).
   - Every link along the chosen path must possess sufficient available headroom ($C_e - B_e \ge V_{\text{stream}}$).
   - If any link's headroom is lower, traffic buffers spill, causing packet loss.
2. **Latency SLA Budget ($\text{ms}$):**
   - Each challenge specifies a Maximum Allowable Latency (e.g., `SLA: 85ms`).
   - If a player builds a 7-hop wide detour to avoid all bottlenecks, the cumulative transit time ($110\text{ms}$) violates the SLA.
   - Forces players to balance capacity vs. geographic transit delay.
3. **Diagnostic Probe Tokens (Count: 3 to 5):**
   - Players cannot spam unlimited test pings to probe every link in the network.
   - Encourages visual inspection of displayed link ratings before pinging.
4. **Packet Integrity / Drop Budget ($\%$):**
   - Medical and encrypted payloads require strictly $0.0\%$ loss.
   - Resilient video/sensor streams may tolerate $\le 2.0\%$ loss.

---

## 8. Failure Design & The 4-Tier Causal Diagnostic

When a transmission fails, the game **never** displays a generic `"WRONG ROUTE"` or `"TRY AGAIN"` message. 

Instead, the **Causal Failure Diagnostic Modal** activates, breaking down the exact physics of the failure into 4 pedagogical tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ ❌ TRANSMISSION ABORTED // BUFFER OVERFLOW DETECTED                     │
├────────────────────────────────────────────────────────────────────────┤
│ 1. WHAT YOU ROUTED:                                                    │
│    Path: [TX] ──► [ALPHA_RELAY] ──► [CORE_SWITCH] ──► [RX]             │
│    Stream Volume: 4.5 Gbps  |  Target Latency SLA: ≤ 75ms              │
│                                                                        │
│ 2. WHAT ACTUALLY HAPPENED:                                             │
│    Packet stream traversed [TX] ──► [ALPHA_RELAY] cleanly.             │
│    At Link [ALPHA_RELAY ──► CORE_SWITCH], switch buffers overflowed.   │
│    Packet Loss: 42.2% (1.9 Gbps dropped)  |  Effective Latency: 165ms │
│                                                                        │
│ 3. WHY THE NETWORK FAILED:                                             │
│    Link capacity is 5.0 Gbps with 2.4 Gbps of ambient background load. │
│    Available Headroom was only 2.6 Gbps.                               │
│    Injecting 4.5 Gbps exceeded link buffer threshold by 1.9 Gbps.      │
│                                                                        │
│ 4. WHAT INFORMATION YOU CAN USE TO ADAPT:                              │
│    Inspect [ALPHA_RELAY]: It has an unselected egress link to          │
│    [OPTICAL_TRUNK_B] with 10.0 Gbps capacity and 8.0 Gbps headroom.    │
├────────────────────────────────────────────────────────────────────────┤
│  [ 🔄 SPLICE & REROUTE VIA OPTICAL_TRUNK_B ]   [ ✕ DISMISS & INSPECT ]  │
└────────────────────────────────────────────────────────────────────────┘
```

### In-Place Splicing & Recovery
Clicking **[SPLICE & REROUTE]** retains the valid prefix (`[TX] ──► [ALPHA_RELAY]`) and prompts the user to pick the alternate next hop, preventing frustrating full-route re-clicks.

---

## 9. Anti-Guessing Design

To guarantee students cannot pass through mindless trial-and-error clicking:

1. **Combinatorial Path Topology:**
   - Graphs contain 8 to 14 nodes and 16 to 24 links.
   - The number of possible simple paths from `TX` to `RX` ranges from 12 to over 40.
   - Guessing randomly has less than an $8\%$ probability of hitting a valid capacity-compliant path.
2. **Diagnostic Probe Budget:**
   - The player only has 3–5 probes. They cannot ping every possible permutation.
3. **Penalty for Reckless Overload:**
   - Attempting a full primary transmission that crashes a link records an **Overload Incident**, reducing the Clean-Sheet Reliability bonus in scoring.
4. **Transparent Inspection:**
   - Hovering any link instantly displays its specifications:
     `Link: [N2 ➔ N5] | Capacity: 10 Gbps | Ambient Load: 3.2 Gbps | Headroom: 6.8 Gbps | Latency: 12ms`.
   - Because all necessary data is visible on screen, reading the data is **10x faster** than random clicking.

---

## 10. The 30-Second Onboarding Test

Can a student with zero computer science experience understand what to do within 30 seconds?

```
┌────────────────────────────────────────────────────────────────────────┐
│  FIELD MANUAL: TRAFFIC CONTROL IN 30 SECONDS                           │
├────────────────────────────────────────────────────────────────────────┤
│  1. CONNECT THE PATH:                                                  │
│     Click nodes from [TX] to [RX] to chart your data highway.          │
│                                                                        │
│  2. WATCH THE PIPES:                                                   │
│     Every cable has a maximum width (Gbps).                            │
│     If your data stream is wider than the cable, packets spill!        │
│                                                                        │
│  3. DISPATCH & DELIVER:                                                │
│     Hit [SEND TEST PING] to check for bottlenecks.                     │
│     Hit [TRANSMIT STREAM] when your route is clear!                    │
└────────────────────────────────────────────────────────────────────────┘
```

- **Target Mental Model:**  
  $$\text{Origin (TX)} \longrightarrow \text{Pick Cables} \longrightarrow \text{Check Width} \longrightarrow \text{Deliver to RX}$$
- Verified: Zero algorithmic jargon; pure intuitive spatial and capacity reasoning.

---

## 11. Spectator Stage / Projector Experience

When played in an auditorium or club room, the public projector display (`http://localhost:5173/stage/:roomCode`) transforms into a dramatic **Global Network NOC Command Center**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🌐 TERMINAL NOC // SUBNET APEX-6 TRAFFIC CONTROL              ⏱ TIME REMAINING: 02:45 │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ACTIVE STREAM: 4.5 Gbps HOSPITAL TELEMETRY  |  GLOBAL DELIVERY RATE: 84.2%  |  AGENTS: 42│
├────────────────────────────────────────────────────────┬───────────────────────────────┤
│                                                        │ 🏆 TOP TRAFFIC CONTROLLERS    │
│           [N1] ─────────────── [N4]                    ├───────────────────────────────┤
│          /    \               /    \                   │ #1  Agent_Cipher    420 pts   │
│       (10G)   (2G!)        (10G)   (10G)               │ #2  Packet_Rider    390 pts   │
│       /          \         /          \                │ #3  Dev_Dave        350 pts   │
│   [TX] ─────────── [CORE] ────────────► [RX]           │ #4  Byte_Me         310 pts   │
│       \          /         \          /                ├───────────────────────────────┤
│       (5G)    (10G)         (4G!)   (10G)              │ 📡 LIVE ROUTE DISPATCHES      │
│          \    /               \    /                   │ • [Agent_Cipher] Delivered!   │
│           [N2] ─────────────── [N3]                    │   Path: TX-N1-CORE-RX (42ms)  │
│                                                        │ • [Noob_99] Buffer Overflow!  │
│   PULSING HEATMAP: Green = Smooth | Red = Congested    │   Dropped 1.8 Gbps at N1-N4   │
└────────────────────────────────────────────────────────┴───────────────────────────────┘
```

### Stage Spectator Features:
1. **Dynamic Animated Packet Pulses:**
   - Multiple glowing packet trains travel along links in real time as students dispatch probes and transmissions.
2. **Network Heatmap & Link Saturation:**
   - Congested links pulse hot yellow and flashing red across the whole graph when students overload them.
3. **Live Ticker of Strategic Divergence:**
   - Ticker shows what different players chose:
     *"Analyst_Sarah discovered the 10G Southern Bypass (0% Loss)!"*
     *"Analyst_Alex successfully completed multi-path split!"*
4. **Zero Solution Leaks:**
   - The Stage shows real-time aggregate activity and individual player outcomes without displaying any single player's solution path before the round ends.

---

## 12. Scoring Architecture

The scoring model rewards deep analytical deduction, bottleneck avoidance, and efficiency, rather than pure twitch speed:

$$\text{Final Score} = \text{Base Points} + \text{Capacity Safety Bonus} + \text{Latency Margin Bonus} + \text{Clean Sheet Bonus} - \text{Probe Overuse}$$

| Scoring Component | Points | Condition |
| :--- | :--- | :--- |
| **Base Delivery Points** | $+100\text{ pts}$ | Transmission successfully reaches `RX` within SLA deadline and packet loss tolerance. |
| **Zero-Loss Integrity Bonus** | $+50\text{ pts}$ | Exactly $0.0\%$ packet loss throughout the entire transmission. |
| **Latency SLA Margin Bonus** | Up to $+50\text{ pts}$ | Scaled based on remaining latency headroom: $\left(\frac{\text{SLA} - \text{ActualLatency}}{\text{SLA}}\right) \times 50\text{ pts}$. |
| **Clean Sheet (First-Run Delivery)** | $+50\text{ pts}$ | Successfully delivered on the very first full transmission without causing a link overflow. |
| **Probe Efficiency Bonus** | $+10\text{ pts}$ per unused probe | Rewarding students who deduce link headroom by visual inspection rather than brute-force probing. |
| **Overload Penalty** | $-25\text{ pts}$ | Deducted if a student dispatches a blind stream that blows a switch buffer into critical failure. |

**Maximum Possible Score:** $280\text{ pts}$ (Flawless first-run delivery via optimal high-capacity path with minimal probe expenditure).

---

## 13. Server-Authoritative Architecture & Security

The frontend client acts strictly as an input capture and rendering canvas. The backend server maintains $100\%$ authoritative control over the network simulation:

### 13.1 Server-Side Validation Pipeline

```
CLIENT SUBMISSION: { route: ["TX", "N1", "N4", "RX"], probeOnly: false }
                            │
                            ▼
1. PATH TOPOLOGY VERIFICATION
   • Does route start at challenge.graph.source?
   • Does route end at challenge.graph.target?
   • Does every contiguous pair (v_i, v_{i+1}) exist as a valid edge in challenge.graph.edges?
   • Does path contain illegal loops (unless cycle routing is explicitly permitted)?
                            │
                            ▼
2. CAPACITY & HEADROOM SIMULATION
   • For each link e in path:
     - Load_e = e.backgroundLoad + payloadVolume
     - If Load_e > e.capacity:
         Calculate packet loss % and buffer delay
                            │
                            ▼
3. CUMULATIVE LATENCY & SLA EVALUATION
   • TotalLatency = Sum(e.latency + e.queueDelay)
   • Check if TotalLatency <= challenge.sla.maxLatency
   • Check if TotalLoss <= challenge.sla.maxLoss
                            │
                            ▼
4. SCORE CALCULATION & BROADCAST
   • Compute base points, safety bonus, latency bonus, and probe deductions.
   • Record Submission in database via Prisma.
   • Emit `session_state_update` to Session Room and Stage with sanitized telemetry.
```

### 13.2 Security Rules:
1. **No Client-Calculated Success:**
   - The client never sends `isCorrect: true` or `calculatedLatency: 45`. Any such fields in the HTTP request payload are stripped and ignored.
2. **Hidden Future Network Disruptions:**
   - If a challenge features dynamic link failures (e.g. at $T+30\text{s}$ a background backup starts on link $N2 \to N3$), this schedule lives solely in `Challenge.config` on the server. The client receives updates only when the event actually triggers.
3. **Token Verification:**
   - Standard JWT authentication via `terminal_token` in HTTP `Authorization: Bearer` and Socket handshake.

---

## 14. Configuration Schema (`Challenge.config`)

The `SIGNAL_ROUTER` template is entirely configuration-driven. No scenario-specific nodes, links, or narratives are hardcoded in React.

```json
{
  "scenarioId": "ROUTER-OP-01",
  "scenarioTitle": "OPERATION FIBER_BURST: EMERGENCY HOSPITAL TELEMETRY",
  "missionBrief": "A critical 4.5 Gbps medical telemetry stream from Saint Jude Regional Clinic (TX) must reach the Medical Diagnostic Center (RX). Core lines are experiencing evening rush-hour congestion. Route the stream without blowing switch buffers or exceeding the 80ms latency deadline.",
  "stream": {
    "payloadVolumeGbps": 4.5,
    "streamType": "CRITICAL_TELEMETRY",
    "slaMaxLatencyMs": 80,
    "slaMaxLossPercent": 0.0
  },
  "graph": {
    "sourceNodeId": "NODE_TX",
    "targetNodeId": "NODE_RX",
    "nodes": [
      { "id": "NODE_TX", "label": "ST_JUDE_INGRESS", "type": "INGRESS", "x": 10, "y": 50 },
      { "id": "NODE_N1", "label": "NORTH_GATEWAY", "type": "GATEWAY", "x": 35, "y": 20 },
      { "id": "NODE_N2", "label": "METRO_CORE", "type": "CORE_ROUTER", "x": 35, "y": 80 },
      { "id": "NODE_N3", "label": "OPTICAL_HUB_A", "type": "CORE_ROUTER", "x": 65, "y": 20 },
      { "id": "NODE_N4", "label": "RIVER_RELAY", "type": "RELAY", "x": 65, "y": 80 },
      { "id": "NODE_RX", "label": "MED_CENTER_RX", "type": "EGRESS", "x": 90, "y": 50 }
    ],
    "links": [
      {
        "id": "LINK_TX_N1",
        "from": "NODE_TX",
        "to": "NODE_N1",
        "capacityGbps": 10.0,
        "backgroundLoadGbps": 2.0,
        "latencyMs": 15,
        "lossRate": 0.0,
        "description": "High-speed municipal optical fiber."
      },
      {
        "id": "LINK_TX_N2",
        "from": "NODE_TX",
        "to": "NODE_N2",
        "capacityGbps": 5.0,
        "backgroundLoadGbps": 3.8,
        "latencyMs": 10,
        "lossRate": 0.0,
        "description": "Legacy copper backbone (Strained)."
      },
      {
        "id": "LINK_N1_N3",
        "from": "NODE_N1",
        "to": "NODE_N3",
        "capacityGbps": 10.0,
        "backgroundLoadGbps": 1.0,
        "latencyMs": 20,
        "lossRate": 0.0,
        "description": "Long-distance optical line."
      },
      {
        "id": "LINK_N1_N4",
        "from": "NODE_N1",
        "to": "NODE_N4",
        "capacityGbps": 3.0,
        "backgroundLoadGbps": 0.5,
        "latencyMs": 12,
        "lossRate": 0.0,
        "description": "Secondary microwave link."
      },
      {
        "id": "LINK_N2_N4",
        "from": "NODE_N2",
        "to": "NODE_N4",
        "capacityGbps": 5.0,
        "backgroundLoadGbps": 1.2,
        "latencyMs": 18,
        "lossRate": 0.0,
        "description": "Substation conduit."
      },
      {
        "id": "LINK_N3_RX",
        "from": "NODE_N3",
        "to": "NODE_RX",
        "capacityGbps": 10.0,
        "backgroundLoadGbps": 2.5,
        "latencyMs": 15,
        "lossRate": 0.0,
        "description": "Hospital campus primary link."
      },
      {
        "id": "LINK_N4_RX",
        "from": "NODE_N4",
        "to": "NODE_RX",
        "capacityGbps": 4.0,
        "backgroundLoadGbps": 0.0,
        "latencyMs": 10,
        "lossRate": 0.0,
        "description": "Emergency backup feed."
      }
    ]
  },
  "probeTokens": 3,
  "scoring": {
    "basePoints": 100,
    "zeroLossBonus": 50,
    "firstRunCleanSheetBonus": 50,
    "latencyHeadroomMaxBonus": 50,
    "unusedProbeBonus": 10,
    "overloadPenalty": 25
  },
  "hints": [
    "Check available headroom on legacy copper routes before committing.",
    "A route with more hops on optical fiber can deliver lower latency than a congested short link."
  ],
  "revealConcept": {
    "title": "WHAT YOU JUST EXPERIENCED: GRAPH ROUTING & BOTTLENECK ANALYSIS",
    "summary": "In network engineering, Dijkstra's algorithm finds the shortest path, but real networks run constrained shortest-path or max-flow algorithms. Link capacity and queuing congestion mean the path with the fewest hops is frequently the slowest or prone to packet loss."
  }
}
```

---

## 15. The 10-Point Pre-Implementation Stress Test

Before writing a single line of production code, the `SIGNAL_ROUTER` game design was subjected to the mandatory 10-point stress test:

| Test # | Stress Test Dimension | Evaluation & Verification | Result |
| :---: | :--- | :--- | :---: |
| **1** | **Beginner Comprehension** | Can a student with zero knowledge of Dijkstra or graphs play immediately? **YES:** The objective is framed as piping water/data through wires without bursting the pipe. All controls are visual. | **PASS** |
| **2** | **30-Second Test** | Can the core loop be understood in 30 seconds? **YES:** Simple 3-step prompt: Trace Path $\to$ Check Pipe Width $\to$ Click Transmit. | **PASS** |
| **3** | **Multiple Valid Routes** | Does the design support at least 2–3 viable strategies with trade-offs? **YES:** Express Direct (Speed bonus, low safety margin), Backbone Detour (Rock-solid safety, moderate latency), and Multi-Path Split. | **PASS** |
| **4** | **Resource Pressure** | Do bandwidth capacity, latency budget, and probe tokens force real decisions? **YES:** Players cannot blindly choose the widest path (violates latency SLA) nor the shortest path (violates bandwidth capacity). | **PASS** |
| **5** | **Failure Causality** | Does failure teach rather than punish? **YES:** The 4-Tier Diagnostic explains what happened, which link overflowed, by how much (Gbps), and where alternate headroom exists. | **PASS** |
| **6** | **Anti-Guessing** | Does the system prevent random brute-force clicking? **YES:** With 15–25 links, guessing has $< 8\%$ success rate; probe tokens are limited; hovering reveals link headroom 10x faster. | **PASS** |
| **7** | **No Hidden Arbitrary Rules** | Are all failure mechanics explained by physics and visible data? **YES:** Every drop is calculated by $B_e + V_{\text{stream}} > C_e$. No invisible traps or mystery triggers. | **PASS** |
| **8** | **Meaningful Stage Experience** | Does the projector tell a dramatic spectator story? **YES:** Real-time animated packet flows, link congestion heatmaps, and live delivery tickers give audiences full visibility without spoiling solutions. | **PASS** |
| **9** | **Learning Transfer** | Does gameplay transfer to real computer science concepts? **YES:** The debrief directly maps the experience to Dijkstra, max-flow/min-cut, bottleneck bandwidth, and queue buffer bloat. | **PASS** |
| **10** | **Distinct Identity** | Is the game completely distinct from Logic Heist, Dead Code, The Witness, Rogue Scanner, and Silent Mission? **YES:** No code blocks (Logic Heist), no stack traces (Dead Code), no binary interrogation (The Witness), no event log triage (Rogue Scanner), and no action DAG sequencing (Silent Mission). It is a pure spatial network topology routing game. | **PASS** |

---

## 16. Implementation Roadmap (Phase 9A)

When authorization is granted to proceed with code implementation, the rollout will follow this phased engineering sequence:

1. **Step 1: Engine & Contract Registration (`server/src/engine/`)**
   - Register template `SIGNAL_ROUTER` in `TemplateRegistry.ts`.
   - Implement `Validator.ts` case: `ROUTER_FLOW` evaluating path continuity, hop capacity, queuing latency, packet loss, and multi-factor scoring.
2. **Step 2: Interactive Network Canvas (`client/src/components/RouterChallenge.tsx`)**
   - Implement SVG Cybercore network topology graph with glowing nodes, interactive link selection, and animated packet pulse simulations.
   - Implement Waypoint Corridor with real-time bottleneck detection and headroom gauges.
   - Implement 4-tier Causal Diagnostic Modal with in-place splicing.
3. **Step 3: Stage Spectator View (`client/src/pages/StagePage.tsx`)**
   - Add `currentGame?.template === 'SIGNAL_ROUTER'` Stage Mode.
   - Render real-time cluster topology heatmap, global throughput meters, live packet streams, and spectator ticker.
4. **Step 4: End-to-End Automated QA Suite (`test_signal_router.js`)**
   - Multi-stage automated verification suite covering single-path routing, capacity overflow detection, SLA latency violations, probe token limits, security spoof rejections, and stage synchronization.
5. **Step 5: Human Playtest Protocol & Findings Report (`SIGNAL_ROUTER_PLAYTEST_REPORT.md`)**
   - Live human playtest session configuration and observation log.

---

## 17. Final Status

```
==================================================
SIGNAL ROUTER
CODENEX SIGNATURE GAME: GRAPH ROUTING & NETWORK FLOW
DESIGN COMPLETE
GAMEPLAY STRESS TEST COMPLETE (10 / 10 PASSED)
READY FOR IMPLEMENTATION AUTHORIZATION
==================================================
```
