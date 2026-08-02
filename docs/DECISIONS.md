# Architecture and Product Decisions

## ADR-001 — Desktop-first product
**Date:** 2026-08-02  
**Status:** Accepted

OnlyBeats is designed primarily as a Windows second-screen experience for game day. Responsive layouts remain important, but desktop workflow and information density take priority.

## ADR-002 — Tauri 2 and Rust
**Date:** 2026-08-02  
**Status:** Accepted

Tauri provides a lightweight native shell while Rust provides controlled access to networking, SQLite, filesystem operations, and packaging.

## ADR-003 — SQLite local-first storage
**Date:** 2026-08-02  
**Status:** Accepted

Settings, favorites, cached information, and future personal data should remain useful offline and should not require an account. Schema changes require versioned migrations.

## ADR-004 — Provider abstraction
**Date:** 2026-08-02  
**Status:** Accepted

External score, weather, ranking, news, and availability data must be normalized behind provider adapters so the interface is not tightly coupled to one raw response format.

## ADR-005 — No fake live data
**Date:** 2026-08-02  
**Status:** Accepted

The application must clearly distinguish live, cached, preview, unavailable, and placeholder states. It must never present fabricated data as a current provider response.

## ADR-006 — GitHub is the source of truth
**Date:** 2026-08-02  
**Status:** Accepted

Source, documentation, issues, pull requests, release history, and automated builds belong in the GitHub repository. Generated dependency and target folders are excluded.

## ADR-007 — Infrastructure release before Saturday Wall
**Date:** 2026-08-02  
**Status:** Accepted

Version 0.2.2 focuses on documentation, automation, and contribution standards so v0.3.0 can be developed against a stable process.


## 2026-08-02 — Weather provider
Use Open-Meteo for stadium-area weather because it supports geocoding and current/hourly forecast data without hard-coded API secrets. Weather failures remain non-blocking.

## 2026-08-02 — Game Focus Mode
Focus Mode is an overlay rather than a separate route so users can return to the Saturday Wall without losing filters or scroll context.

## 2026-08-02 — Prediction confidence scoring

**Decision:** Confidence accepts any positive numeric value. Correct predictions earn the exact confidence value; incorrect predictions earn zero.

**Reason:** This provides a flexible personal scoring system without calculating financial returns or connecting to wagering services.
