# OptiBlock 🚆

### Intelligent Automatic Block Planning System

OptiBlock is an explainable, optimization-based railway block planning system designed to coordinate maintenance activities and identify suitable time windows with minimal disruption to train operations.

The system analyzes maintenance requests, evaluates their priority and constraints, identifies compatible work that can be performed together, and generates an optimized block schedule based on railway traffic conditions.

---

## Overview

Railway maintenance requires temporary blocks during which a section of railway infrastructure is made available for maintenance work.

When multiple departments request blocks independently, this can result in:

- Overlapping maintenance requests
- Underutilized block windows
- Unnecessary track possession time
- Conflicts between departments
- High-traffic maintenance windows
- Idle maintenance resources

OptiBlock addresses this through automated request analysis, work fusion, traffic-aware scheduling, and conflict detection.

---
## 📌 Problem

Railway maintenance activities require specific blocks during which railway assets such as tracks, signals, and other infrastructure can be taken out of service.

Planning these blocks manually can be difficult because multiple factors need to be considered simultaneously:

- Train movement and operational schedules
- Maintenance requirements
- Asset availability
- Block duration
- Conflicting maintenance activities
- Operational constraints
- Limited maintenance windows

Poorly planned blocks can result in unnecessary asset downtime, conflicts between maintenance activities, and disruption to railway operations.

**OptiBlock aims to provide an automated and data-driven approach to this problem.**

---

## 💡 Solution

OptiBlock takes maintenance and operational information as input and processes it through an optimization-based planning engine.

The system:

1. Accepts maintenance and operational data.
2. Identifies available block windows.
3. Evaluates conflicts and constraints.
4. Prioritizes maintenance activities.
5. Generates an optimized block plan.
6. Displays the resulting schedule through a web interface.


# Core Concept

The central idea behind OptiBlock is to avoid treating every maintenance request as an isolated task.

Instead, the system:

Maintenance Requests
        ↓
Priority Analysis
        ↓
Compatibility Detection
        ↓
Work Fusion
        ↓
Traffic Analysis
        ↓
Constraint-Aware Scheduling
        ↓
Conflict Detection
        ↓
Optimized Block Plan

The goal is to maximize asset availability while ensuring that maintenance activities are scheduled within feasible operational windows.

---

## 🎯 Key Objectives

- Automate railway block planning.
- Reduce manual planning effort.
- Minimize conflicts between maintenance activities.
- Improve utilization of available maintenance windows.
- Reduce unnecessary asset downtime.
- Prioritize critical maintenance activities.
- Provide a clear and understandable planning interface.

  # 🛠️ Current Technology Stack

OptiBlock's current working prototype is built using a lightweight Python-based architecture.

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5 | Dashboard structure and UI |
| Styling | CSS3 | Dashboard layout, components and visual styling |
| Client-side Logic | JavaScript | API communication, interactions and dynamic rendering |
| Backend | Python | Core application and server-side processing |
| Web Framework | Flask | REST API and web application |
| Optimization Engine | Python | Priority scoring, compatibility analysis, block fusion and scheduling |
| Scheduling Approach | Greedy Heuristic | Priority-based constraint-aware scheduling |
| Data | Synthetic Railway Data | Demonstration timetable, sections, trains and maintenance requests |
| Communication | REST API / JSON | Frontend ↔ Flask backend communication |
| Version Control | Git | Source-code version management |
| Repository | GitHub | Project hosting and collaboration |


Current architecture
```text
User
↓
Block Requests
↓
Priority Engine
↓
Compatibility / Fusion Engine
↓
Traffic Analysis
↓
Constraint-Aware Scheduler
↓
Conflict Detection
↓
KPI Calculation
↓
Dashboard
```


The current prototype uses:

Python + Flask for the backend
HTML + CSS + JavaScript for the frontend
A Python-based greedy heuristic for optimization
Synthetic railway/timetable data
REST APIs with JSON
In-memory application state
