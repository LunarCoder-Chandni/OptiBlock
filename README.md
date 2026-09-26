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
