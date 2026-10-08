# Admin Lab Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the logical closure, physical stop/snapshot failure and confirmed retained-resource state of shared event laboratories and team groups in existing admin monitoring.

**Architecture:** The backend/Laboratory publish identity-matched lifecycle observations and conservative allocation totals. Admin renders those fields without calculating released capacity from logical closure or request acceptance. First-delivery tasks cover shared automatic completion; subsequent-delivery tasks cover stage retention/group pause/prewarm without adding operation powers.

**Tech Stack:** Installed Next.js 16.3.6, React 19.3.0, TypeScript, Zod 4.6.5, current polling hooks, Vitest and Testing Library. No new dependency or TanStack provider is introduced.

**Spec:** `/Volumes/Projects/My/CyberICEBox/laboratory/docs/superpowers/specs/2026-10-08-lab-lifecycle-design.md` at owner-approved commit `f5c8bfb`. Companion consumer plan: `/Volumes/Projects/My/CyberICEBox/event-frontend/docs/superpowers/plans/2026-10-08-event-lab-lifecycle.md`.

## Global Constraints

- "Keep one LabGroup per participation unit/team. Group sharing is not implemented."
- "Actual capacity is credited only after identity-matching release confirmation."
- "Missing or stale observations mean Unknown, not zero usage or free capacity."
- "Count one allocation per shared Lab, one VPN/gateway overhead per team group, pending starts and retained storage."
- "A solved laboratory is terminal for participant runtime"; "Group start alone never changes child stopped intent."
- "Closing a stage is a stop, not immediate deletion." Retention expiry deletion has separate confirmation.
- Snapshot success preserves writable filesystem state and UID/GID mappings; it does not promise process memory or unrecorded runtime network changes. Required snapshot failure retains runtime allocations and shows StopFailed.
- Academic/event active-lab limits are configurable policy. VPN 80 MiB/50m and gateway 32 MiB/25m are unvalidated engineering candidates until native measurements pass; do not relabel them as supported presets in this plan.
- i18n keys in both uk/en, platform crest loader, shared centered empty/error states and existing confirmation. No academy portal, forced-team-stop button, release, push or PR.
- Work on `feat/event-lab-lifecycle`. Current authorization covers this plan file only; code/commits follow primary plan gate. `/docs/` is ignored by `.gitignore:39`: preserve that rule and use exact `git add -f docs/superpowers/plans/2026-10-08-admin-lab-lifecycle.md` only for an authorized plan checkpoint.

## Review Focus

1. Logical closure with StopFailed still holds compute: test the failure and unchanged resource ledger together.
2. Older observation/identity cannot prove release: test observed revision lag, missing UID/time and explicit Unknown resources.
3. Shared questions and group overhead cannot be double counted: test canonical rows/questions and Held breakdown without re-adding pending/group amounts.
4. Retained snapshots are independent of freed compute: test Released compute with Retained/CleanupPending storage, including physically unknown storage.
5. Stage/group preparation cannot restart solved children or create premature readiness: test paused/prewarming group observations with solved children unchanged and no operation request.

## Frozen producer contracts

The backend agent agreed these exact fields on 2026-10-08. All new int64 quantities and revisions use canonical decimal strings. Existing numeric reservation, measured-usage and `InUse/Free` fields remain API-compatible; their allocation source becomes the acknowledged conservative ledger. Do not convert missing new objects to zero.

```ts
export type Decimal = string;
export type ComputeView = {CPUMillicores: Decimal; MemoryBytes: Decimal};
export type AllocationView = {
    ConfiguredRequests: ComputeView; ConfiguredLimits: ComputeView;
    AllocatedRequests: ComputeView; Used: ComputeView; ReleasedRequests: ComputeView;
    RuntimeState: "Allocated" | "Releasing" | "Released" | "Unknown";
    ObservedAt: string | null; ReleasedAt: string | null; UsageAvailable: boolean;
    SnapshotQuotaBytes: Decimal;
    StorageState: "None" | "Retained" | "DeleteRequested" | "CleanupPending" | "Deleted" | "Unknown";
    PhysicalStorageBytesAvailable: boolean; PhysicalStorageBytes: Decimal;
};
export type ManagedActualState = "Running" | "Snapshotting" | "Stopping" | "Stopped" | "StopFailed" | "Starting" | "Unknown" | "Deleting" | "Deleted";
export type ManagedLabView = {
    ID: string; EventExerciseID: string; TeamID: string; ExerciseName: string;
    Revision: Decimal; ObservedRevision: Decimal; Generation: number; AgentUID: string;
    DesiredState: "Running" | "Stopped" | "Deleted"; ActualState: ManagedActualState;
    CloseReason: null | "solved" | "manual" | "stage" | "event";
    ClosedAt: string | null; ActualStoppedAt: string | null;
    RetentionUntil: string | null; ObservedAt: string | null;
    SnapshotState: "NotRequired" | "Pending" | "Succeeded" | "Failed" | "Unknown";
    FailureCode: string; FailureMessage: string; Resources: AllocationView;
};
export type ManagedGroupView = {
    Name: string; Revision: Decimal; ObservedRevision: Decimal; AgentUID: string;
    DesiredState: "Running" | "Stopped" | "Deleted"; ActualState: ManagedActualState;
    Ready: boolean; ObservedAt: string | null;
    FailureCode: string; FailureMessage: string; Resources: AllocationView;
};
export type ResourceObservation = {
    ObservedAt: string | null; Complete: boolean;
    Held: ComputeView & {SnapshotQuotaBytes: Decimal};
    PendingStarts: ComputeView; GroupServices: ComputeView;
    PhysicalStorageBytesAvailable: boolean; PhysicalStorageBytes: Decimal;
};
```

`StandDetail.Group` is `ManagedGroupView`; `Labs[]` is one canonical shared Lab row `{ChallengeID,ChallengeName,Status,Reason,Questions:[{EventChallengeID,Name}],Lab:ManagedLabView,Live:null|existing,LiveUnavailable}`. `ChallengeID` is a representative existing question ID for legacy device endpoints; `Questions` names all its dependent questions. Do not duplicate a Lab's physical block per question. Legacy rows without `Lab` and legacy detail without `Group` remain readable through null/empty defaults; lifecycle guarantees and new actions must not be inferred from such rows.

`ManageResources.Observation` and admin `Stats.Observation` use `ResourceObservation`. Held includes PendingStarts and GroupServices already. ReleasedRequests is producer-credited only after a matching actual release acknowledgement. Retained storage is separately represented; compute release never implies storage release. No frontend arithmetic creates credits.

Effective event configuration is `Config.LabPolicy={SnapshotMode:"skip"|"required",MaxActiveLabsPerTeam:number|null,RetentionMinutes:number}`; active limit is 1..1000 or null, retention 0..10080 minutes, backend defaults skip/null/60. Stages add `LabRetentionMinutes:number|null` (null inherits event policy). Participant subsequent lifecycle metadata is `SnapshotPolicy:"none"|"required"` and `RetentionUntil:string|null`. Admin displays this policy through event links/observations; editing remains in event settings. Existing teardown delay is final event cleanup timing, not a second independent stage-retention setting.

Local Next guidance read in this repo: `node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md` and `01-app/02-guides/client-side-data-fetching/tanstack-query.md`. Retain existing client polling and route/provider boundaries; no server-cache API or route creation is needed.

## File map

- Create `src/api/labLifecycle.ts` and `.test.ts`: new runtime-checked observation contracts.
- Create `src/test/labLifecycle.ts`: test-only canonical shared Lab/group/resource fixtures.
- Modify `src/api/infrastructure.ts:172,187`: optional additive lifecycle fields and parsed new observations.
- Modify `src/api/resourceCalendar.ts:99-103`: additive optional `Stats.Observation`, preserving existing fields.
- Create `src/components/infrastructure/LifecycleFacts.tsx` and `.test.tsx`: read-only lifecycle/snapshot/failure/resource details.
- Create `src/lib/labResourceObservation.ts` and `.test.ts`: decimal-safe display and current-observation checks only, never allocation calculations.
- Modify `src/components/infrastructure/LabDetailDialogs.tsx:75-109`, `LabLiveView.tsx`, `useLabDetail.ts` only for observation freshness preservation; author TestLab behavior remains unchanged.
- Create `src/components/resources/ObservationFacts.tsx` and `.test.tsx`; modify `StatsTab.tsx` to render producer totals and explicit completeness/storage status.
- Modify both message catalogs. No global CSS/design-system change or admin forced-stop/start control.

### Task A1: Add exact lifecycle/resource observation contracts

**Files:** Create `src/api/labLifecycle.ts`, `src/api/labLifecycle.test.ts`, `src/test/labLifecycle.ts`; modify `src/api/infrastructure.ts`, `src/api/resourceCalendar.ts`; add `src/api/infrastructure.lifecycle.test.ts`.

**Interfaces:** Consumes frozen contract above. Produces `ManagedLabSchema`, `ManagedGroupSchema`, `AllocationSchema`, `ResourceObservationSchema`, matching inferred TypeScript types, and parsed optional `StandDetail.Group`, `StandLabDetail.Lab/Questions`, `Stats.Observation`.

- [ ] Add the test fixture and failing validation tests. Fixture quantities deliberately exceed safe integers:

```ts
const compute = {CPUMillicores: "250", MemoryBytes: "104857600"};
export const allocation = {
    ConfiguredRequests: compute, ConfiguredLimits: compute, AllocatedRequests: compute,
    Used: compute, ReleasedRequests: {CPUMillicores: "0", MemoryBytes: "0"},
    RuntimeState: "Releasing" as const, ObservedAt: "2026-10-08T12:00:00Z", ReleasedAt: null,
    UsageAvailable: true, SnapshotQuotaBytes: "9007199254740993", StorageState: "Retained" as const,
    PhysicalStorageBytesAvailable: false, PhysicalStorageBytes: "0",
};
export const managedLab = {
    ID: "00000000-0000-4000-8000-000000000100", EventExerciseID: "00000000-0000-4000-8000-000000000200",
    TeamID: "00000000-0000-4000-8000-000000000300", ExerciseName: "Shared environment",
    Revision: "12", ObservedRevision: "11", Generation: 1, AgentUID: "lab-uid",
    DesiredState: "Stopped" as const, ActualState: "StopFailed" as const, CloseReason: "solved" as const,
    ClosedAt: "2026-10-08T12:00:00Z", ActualStoppedAt: null, RetentionUntil: "2026-10-08T13:00:00Z",
    ObservedAt: "2026-10-08T12:00:00Z", SnapshotState: "Failed" as const,
    FailureCode: "CaptureFailed", FailureMessage: "snapshot capture failed", Resources: allocation,
};
it("keeps decimal quantities and accepts closed with failed physical stop", () => {
    expect(ManagedLabSchema.parse(managedLab)).toEqual(managedLab);
    expect(AllocationSchema.parse(allocation).SnapshotQuotaBytes).toBe("9007199254740993");
    expect(ManagedLabSchema.safeParse({...managedLab, Revision: 12}).success).toBe(false);
    expect(AllocationSchema.safeParse({...allocation, RuntimeState: "Deleted"}).success).toBe(false);
});
```

Add transport tests with legacy detail missing `Lab/Group/Questions`, canonical row with two Questions and one Live block, unknown allocation state and absent aggregate observation. Legacy remains readable; unknown/missing lifecycle is not treated as physical stopped.

- [ ] Run `npm test -- src/api/labLifecycle.test.ts src/api/infrastructure.lifecycle.test.ts`; missing schemas/parse additions fail.
- [ ] Implement typed schemas with exact fields/enums:

```ts
import {z} from "zod";
const decimal = z.string().regex(/^(0|[1-9]\d*)$/);
export const ComputeSchema = z.object({CPUMillicores: decimal, MemoryBytes: decimal});
export const AllocationSchema = z.object({
    ConfiguredRequests: ComputeSchema, ConfiguredLimits: ComputeSchema,
    AllocatedRequests: ComputeSchema, Used: ComputeSchema, ReleasedRequests: ComputeSchema,
    RuntimeState: z.enum(["Allocated", "Releasing", "Released", "Unknown"]),
    ObservedAt: z.string().nullable(), ReleasedAt: z.string().nullable(), UsageAvailable: z.boolean(),
    SnapshotQuotaBytes: decimal, StorageState: z.enum(["None", "Retained", "DeleteRequested", "CleanupPending", "Deleted", "Unknown"]),
    PhysicalStorageBytesAvailable: z.boolean(), PhysicalStorageBytes: decimal,
});
```

Add the complete remaining schemas, without catch-to-zero/default physical state:

```ts
const actualState = z.enum(["Running", "Snapshotting", "Stopping", "Stopped", "StopFailed", "Starting", "Unknown", "Deleting", "Deleted"]);
const desiredState = z.enum(["Running", "Stopped", "Deleted"]);
const optionalTime = z.string().nullable();
export const ManagedLabSchema = z.object({
    ID: z.string().uuid(), EventExerciseID: z.string().uuid(), TeamID: z.string().uuid(), ExerciseName: z.string(),
    Revision: decimal, ObservedRevision: decimal, Generation: z.number().int().nonnegative(), AgentUID: z.string(),
    DesiredState: desiredState, ActualState: actualState,
    CloseReason: z.enum(["solved", "manual", "stage", "event"]).nullable(),
    ClosedAt: optionalTime, ActualStoppedAt: optionalTime, RetentionUntil: optionalTime, ObservedAt: optionalTime,
    SnapshotState: z.enum(["NotRequired", "Pending", "Succeeded", "Failed", "Unknown"]),
    FailureCode: z.string(), FailureMessage: z.string(), Resources: AllocationSchema,
});
export const ManagedGroupSchema = z.object({
    Name: z.string(), Revision: decimal, ObservedRevision: decimal, AgentUID: z.string(),
    DesiredState: desiredState, ActualState: actualState, Ready: z.boolean(), ObservedAt: optionalTime,
    FailureCode: z.string(), FailureMessage: z.string(), Resources: AllocationSchema,
});
export const ResourceObservationSchema = z.object({
    ObservedAt: optionalTime, Complete: z.boolean(),
    Held: ComputeSchema.extend({SnapshotQuotaBytes: decimal}), PendingStarts: ComputeSchema, GroupServices: ComputeSchema,
    PhysicalStorageBytesAvailable: z.boolean(), PhysicalStorageBytes: decimal,
});
export type ComputeView = z.infer<typeof ComputeSchema>;
export type AllocationView = z.infer<typeof AllocationSchema>;
export type ManagedLabView = z.infer<typeof ManagedLabSchema>;
export type ManagedGroupView = z.infer<typeof ManagedGroupSchema>;
export type ResourceObservation = z.infer<typeof ResourceObservationSchema>;
``` At `getStandDetail`, parse only additive new objects when present and normalize legacy missing objects to null and Questions to an empty array, preserving the existing typed Live. At getStats parse Observation when present and retain null when absent. Keep old API fields and device endpoints exactly.

- [ ] Rerun the targeted tests and `npm run typecheck`; confirm all new quantities remain strings in application state.
- [ ] After primary code/commit authorization, checkpoint `feat: add managed event lab lifecycle observations`.

### Task A2: Read-only physical/snapshot/resource detail

**Files:** Create `src/components/infrastructure/LifecycleFacts.tsx`, `src/components/infrastructure/LifecycleFacts.test.tsx`, `src/lib/labResourceObservation.ts`, `src/lib/labResourceObservation.test.ts`; modify `src/components/infrastructure/LabDetailDialogs.tsx`, `src/components/infrastructure/LabLiveView.tsx`, `src/components/infrastructure/LabDetailDialogs.test.tsx`, both message catalogs.

**Interfaces:** Consumes A1 types. Produces `currentObservation(lab:ManagedLabView|ManagedGroupView):boolean`, `decimalCpu(value:string):string`, `decimalMemory(value:string):string`, `LifecycleFacts({lab:ManagedLabView})`, `AllocationFacts({resources:AllocationView})`, and a group presenter in A4. No mutation function is added.

- [ ] Add failing tests for revision lag, snapshot failure, retained compute, physical unknown storage and safe formatting:

```ts
it("requires current observation metadata and never calls an older revision released", () => {
    expect(currentObservation(managedLab)).toBe(false);
    expect(currentObservation({...managedLab, ObservedRevision: "12"})).toBe(true);
    expect(currentObservation({...managedLab, ObservedRevision: "12", AgentUID: ""})).toBe(false);
    expect(currentObservation({...managedLab, ObservedRevision: "12", ObservedAt: null})).toBe(false);
});
it("retains exact large quantities", () => {
    expect(decimalMemory("9007199254740993")).toContain("9 007 199 254 740 993");
});
```

Use Testing Library to render logically closed/StopFailed fixture: assert translated closed reason, snapshot failed, held 250m/100MiB, failure text, no stop/start/restart button, and unknown physical storage instead of `0 B`. Render one canonical row with two dependent question names and verify one physical device block. `canWrite` never makes a solved environment restartable/resettable. Include current stopped observation with Released compute and Retained snapshot quota to prove separate resources.

- [ ] Run `npm test -- src/lib/labResourceObservation.test.ts src/components/infrastructure/LifecycleFacts.test.tsx src/components/infrastructure/LabDetailDialogs.test.tsx`; missing presenters/checks fail.
- [ ] Implement safe presenter primitives:

```ts
export function currentObservation(lab: ManagedLabView | ManagedGroupView): boolean {
    return lab.Revision === lab.ObservedRevision && lab.AgentUID !== "" && lab.ObservedAt !== null;
}
function safeDecimal(value: string): number | null {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function decimalCpu(value: string): string {
    const number = safeDecimal(value);
    return number === null ? t("admin.labs.resources.exactMcpu", {value: BigInt(value).toLocaleString(UI_LOCALE)}) : formatCpu(number);
}
export function decimalMemory(value: string): string {
    const number = safeDecimal(value);
    return number === null ? t("admin.labs.unit.b", {value: BigInt(value).toLocaleString(UI_LOCALE)}) : formatBytes(number);
}
```

Import existing locale/formatters and frozen types; no BigInt literal is needed. Add the reusable exact allocation rows so group and Lab render the same contract:

```tsx
export function AllocationFacts({resources}: {resources: AllocationView}) {
    const computeText = (value: ComputeView) => t("admin.labs.resources.computeValue", {cpu: decimalCpu(value.CPUMillicores), memory: decimalMemory(value.MemoryBytes)});
    return <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><dt>{t("admin.labs.resources.configuredRequests")}</dt><dd>{computeText(resources.ConfiguredRequests)}</dd></div>
        <div><dt>{t("admin.labs.resources.configuredLimits")}</dt><dd>{computeText(resources.ConfiguredLimits)}</dd></div>
        <div><dt>{t("admin.labs.resources.held")}</dt><dd>{computeText(resources.AllocatedRequests)}</dd></div>
        <div><dt>{t("admin.labs.resources.used")}</dt><dd>{resources.UsageAvailable ? computeText(resources.Used) : t("admin.resources.observation.unknown")}</dd></div>
        <div><dt>{t("admin.labs.resources.released")}</dt><dd>{computeText(resources.ReleasedRequests)}</dd></div>
        <div><dt>{t("admin.labs.resources.snapshotQuota")}</dt><dd>{decimalMemory(resources.SnapshotQuotaBytes)}</dd></div>
        <div><dt>{t("admin.labs.resources.physicalStorage")}</dt><dd>{resources.PhysicalStorageBytesAvailable ? decimalMemory(resources.PhysicalStorageBytes) : t("admin.labs.resources.physicalUnknown")}</dd></div>
        <div><dt>{t("admin.labs.resources.runtime")}</dt><dd>{t(`admin.labs.resources.runtime.${resources.RuntimeState}`)}</dd></div>
        <div><dt>{t("admin.labs.resources.storage")}</dt><dd>{t(`admin.labs.resources.storage.${resources.StorageState}`)}</dd></div>
    </dl>;
}
```

`LifecycleFacts` uses existing `Badge`/definition-list styling, labels separate logical `ClosedAt/CloseReason`, DesiredState, ActualState, snapshot state, observation currency and failure. Display configured requests/limits, held requests, available measured usage, confirmed ReleasedRequests, retained snapshot quota and physically known storage as distinct facts. `currentObservation=false` adds an unknown/stale badge; it never returns resource credits or suppresses retained amounts. Unavailable measured usage and physical storage show translated unknown. Failure messages are data rendered as text, never HTML. Add `data-lab-id` for stable QA/testing.

In `StandDetail`, render one `LifecycleFacts` per new row Lab and its Questions list, then existing inspection Live. Per-device reset/rescue gets `canWrite && row.Lab?.ClosedAt == null` for lifecycle-aware rows; legacy rows retain original behavior. Snapshot inspection stays readable. Current polling remains quiet and preserves data; do not remount detail on revisions, zero amounts on error, or create implicit starts.

Translation namespaces: `admin.labs.lifecycle.logicalClosed`, `.desired.<state>`, `.actual.<state>`, `.snapshot.<state>`, `.observationUnknown`; `admin.labs.resources.configuredRequests`, `.configuredLimits`, `.held`, `.used`, `.released`, `.snapshotQuota`, `.physicalStorage`, `.physicalUnknown`, `.exactMcpu`, `.runtime.<state>`, `.storage.<state>`, `.computeValue` ("{cpu} · {memory}" in both catalogs). Values use ordinary Ukrainian/English operational language; all ActualState values have keys. Snapshot preservation help explicitly says "Зберігається файловий стан, а не памʼять процесів чи незаписані мережеві зміни." / "Filesystem state is retained, not process memory or unrecorded network changes."

- [ ] Rerun tests/typecheck/targeted lint. Inspect desktop/mobile detail once; long exercise/question/failure names wrap, details remain keyboard-readable and actual progress stays in operator views.
- [ ] After primary authorization, checkpoint `feat: show physical event lab stop and retained resources`.

### Task A3: Conservative aggregate resource observations

**Files:** Create `src/components/resources/ObservationFacts.tsx`, `src/components/resources/ObservationFacts.test.tsx`; modify `src/components/resources/StatsTab.tsx`, `src/api/resourceCalendar.ts`, both message catalogs; extend `src/lib/resourceCalendar.test.ts` with observation fixtures. Existing dashboard numeric summary remains producer-owned.

**Interfaces:** Consumes `Stats.Observation:ResourceObservation|null`, A2 decimal formatters and existing server Stats numeric fields. Produces `ObservationFacts({observation:ResourceObservation|null})`, exact held/breakdown/storage display; no sum or optimistic capacity adjustment.

- [ ] Add the failing aggregate test:

```tsx
it("does not add group/pending breakdown to held totals", () => {
    const observation = {ObservedAt: "2026-10-08T12:00:00Z", Complete: false,
        Held: {CPUMillicores: "500", MemoryBytes: "209715200", SnapshotQuotaBytes: "1048576"},
        PendingStarts: {CPUMillicores: "250", MemoryBytes: "104857600"},
        GroupServices: {CPUMillicores: "50", MemoryBytes: "83886080"},
        PhysicalStorageBytesAvailable: false, PhysicalStorageBytes: "0"};
    render(<ObservationFacts observation={observation} />);
    expect(screen.getByTestId("observation-held")).toHaveTextContent("500");
    expect(screen.getByTestId("observation-held")).not.toHaveTextContent("800");
    expect(screen.getByTestId("observation-state")).toHaveTextContent("Неповні спостереження");
    expect(screen.getByTestId("observation-storage")).toHaveTextContent("Невідомо");
});
```

Add `observation:null` and Complete=false/all-zero cases: the summary reports unknown contributors, not zero actual usage/free capacity. Test backend updated Released state changes totals only in the new response. A failed background Stats request retains prior amounts and never creates zero defaults for Observation.

- [ ] Run `npm test -- src/components/resources/ObservationFacts.test.tsx src/lib/resourceCalendar.test.ts`; missing observation display fails.
- [ ] Implement `ObservationFacts` with fixed semantic rows. Directly display `observation.Held`, PendingStarts and GroupServices as breakdowns; never compute Held from the other values. Use the exact completeness rule:

```tsx
if (!observation) return <EmptyState compact message={t("admin.resources.observation.unknown")} />;
const unknown = !observation.Complete;
const computeText = (value: ComputeView) => t("admin.labs.resources.computeValue", {cpu: decimalCpu(value.CPUMillicores), memory: decimalMemory(value.MemoryBytes)});
return <section aria-label={t("admin.resources.observation.title")}>
    <Badge data-testid="observation-state" tone={unknown ? "warn" : "neutral"}>
        {t(unknown ? "admin.resources.observation.incomplete" : "admin.resources.observation.complete")}
    </Badge>
    <dl>
        <div><dt>{t("admin.resources.observation.knownHeld")}</dt><dd data-testid="observation-held">{unknown && observation.Held.CPUMillicores === "0" && observation.Held.MemoryBytes === "0" ? t("admin.resources.observation.unknown") : computeText(observation.Held)}</dd></div>
        <div><dt>{t("admin.resources.observation.pendingStarts")}</dt><dd>{computeText(observation.PendingStarts)}</dd></div>
        <div><dt>{t("admin.resources.observation.groupServices")}</dt><dd>{computeText(observation.GroupServices)}</dd></div>
        <div><dt>{t("admin.labs.resources.snapshotQuota")}</dt><dd>{decimalMemory(observation.Held.SnapshotQuotaBytes)}</dd></div>
        <div><dt>{t("admin.labs.resources.physicalStorage")}</dt><dd data-testid="observation-storage">{observation.PhysicalStorageBytesAvailable ? decimalMemory(observation.PhysicalStorageBytes) : t("admin.resources.observation.unknown")}</dd></div>
    </dl>
</section>;
```

The explicit rows above use A2 decimal formatters and preserve each producer amount. For unknown all-zero Held, show the translated unknown value; otherwise label it as the known conservative held amount. PhysicalStorageBytes is shown only when its availability flag is true. Keep existing reservation and numeric InUse/Free values, clearly separate allocation from measured usage, and do not re-add group overhead or retained quota to compute. Integrate into StatsTab without loading/error remount; failure shows existing compact `LoadError` plus retained data.

Keys: `admin.resources.observation.title` "Підтверджені ресурси" / "Confirmed resources"; `.incomplete` "Неповні спостереження; відомі ресурси залишаються утриманими" / "Incomplete observations; known resources remain held"; `.complete` "Спостереження актуальні" / "Observations are current"; `.unknown` "Невідомо" / "Unknown"; `.knownHeld` "Відомий утриманий обсяг" / "Known held amount"; remaining field labels mirror exact producer names in natural language.

- [ ] Run A1–A3 tests, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run check:ds`. Root first-delivery gate combines event F1–F4 browser behavior with backend durable state/native stop/snapshot/accounting evidence. Mocked admin tests alone cannot establish actual release or validated smaller presets.
- [ ] After primary authorization, checkpoint `feat: render confirmed held event resource observations`.

### Task A4: Retained stage/group pause and prewarm observations

**Files:** Extend `src/components/infrastructure/LifecycleFacts.tsx` with `GroupLifecycleFacts`, its tests, `src/components/infrastructure/LabDetailDialogs.tsx`, `src/components/infrastructure/LabDetailDialogs.test.tsx`, both message catalogs. Event stage policy editing and participant manual controls remain in the event plan.

**Interfaces:** Consumes `StandDetail.Group:ManagedGroupView|null`, canonical child rows and stage/deploy lead from existing event manager links. Produces `GroupLifecycleFacts({group:ManagedGroupView})`; no GroupStart/Stop RPC or participant permission is added.

- [ ] Add tests with Group DesiredState Stopped/ActualState Stopped/Ready=false and a child Lab closed solved; assert group services release and child retained snapshots are shown independently. Change to DesiredState Running/ActualState Starting/Ready=false: show preparing group services, never ready. Finally Running/Ready=true with solved child still closed must preserve the child state. No API POST occurs during render, poll or detail reopen. Include group StopFailed with all child compute stopped: group overhead remains held.
- [ ] Run the lifecycle/detail tests; new group state/readiness assertions fail before implementation.
- [ ] Render exact group state and readiness fields separately:

```tsx
export function GroupLifecycleFacts({group}: {group: ManagedGroupView}) {
    const current = currentObservation(group);
    return <section data-group-name={group.Name} aria-label={t("admin.labs.group.title")}>
        <div className="flex flex-wrap gap-2">
            <Badge tone={group.ActualState === "StopFailed" ? "danger" : "neutral"}>{t(`admin.labs.lifecycle.actual.${group.ActualState}`)}</Badge>
            <Badge tone={group.Ready && current ? "ok" : "warn"}>{t(group.Ready && current ? "admin.labs.group.ready" : "admin.labs.group.notReady")}</Badge>
        </div>
        <p>{t("admin.labs.group.prepareHelp")}</p>
        <AllocationFacts resources={group.Resources} />
        {group.FailureMessage && <p>{group.FailureMessage}</p>}
    </section>;
}
```

The shared `AllocationFacts` interface from A2 renders group-service allocation directly; there is no division by solved question count. Show failure data read-only. Preparation help: "Підготовка враховує запуск сервісів групи, відновлення знімків і готовність мережі. Виконані середовища залишаються зупиненими." / "Preparation includes group services, snapshot restore and network readiness. Completed environments remain stopped." Snapshot policy/retention timestamps display effective producer values without editable admin duplicates. Retention expiry remains CleanupPending/DeleteRequested until Deleted confirmation; a DELETE accepted response is not a capacity/storage credit.

- [ ] Rerun A1–A4 tests and appropriate typecheck/lint/build checks. Primary full-model local smoke verifies current children stopped before group pause, prewarm in existing deployment lead, only unresolved required next-stage children start, and retained expiry separately confirmed. Capture desktop/mobile group/detail UI in one batch.
- [ ] After primary full-model gate and commit authorization, checkpoint `feat: expose retained stage group lifecycle observations`.


## Operational translation values

Use these values for each plan's lifecycle namespaces. The event plan uses `manage.labs.lifecycle.actual.*`/`.snapshot.*`; admin uses `admin.labs.lifecycle.actual.*`/`.snapshot.*`. These are manager/admin-only physical states.

| State | Ukrainian | English |
|---|---|---|
| Running | Працює | Running |
| Snapshotting | Створюється знімок | Creating snapshot |
| Stopping | Зупиняється | Stopping |
| Stopped | Зупинено | Stopped |
| StopFailed | Зупинка не завершилась | Stop failed |
| Starting | Запускається | Starting |
| Unknown | Невідомо | Unknown |
| Deleting | Видаляється | Deleting |
| Deleted | Видалено | Deleted |
| NotRequired | Знімок не потрібен | Snapshot not required |
| Pending | Знімок очікується | Snapshot pending |
| Succeeded | Знімок створено | Snapshot created |
| Failed | Знімок не створено | Snapshot failed |

Resource labels use `manage.resources.observation.*` in event and the explicit `admin.labs.resources.*` / `admin.resources.observation.*` keys in admin: configuredRequests "Запити за конфігурацією" / "Configured requests"; configuredLimits "Ліміти за конфігурацією" / "Configured limits"; held "Утримані ресурси" / "Held resources"; used "Виміряне використання" / "Measured usage"; released "Підтверджено звільнено" / "Confirmed released"; snapshotQuota "Утримана квота знімків" / "Held snapshot quota"; physicalStorage "Фізичне сховище" / "Physical storage"; unknown "Невідомо" / "Unknown"; pendingStarts "Запуски в очікуванні" / "Pending starts"; groupServices "Сервіси групи (входять до загального обсягу)" / "Group services (included in held total)"; complete "Спостереження актуальні" / "Observations are current"; incomplete "Неповні спостереження; відомі ресурси залишаються утриманими" / "Incomplete observations; known resources remain held"; computeValue "{cpu} · {memory}" in both; exactMcpu "{value} mCPU" in both; exactBytes "{value} Б" / "{value} B". `title` is "Підтверджені ресурси" / "Confirmed resources".

Runtime-state resource keys: Allocated "Утримуються" / "Held"; Releasing "Звільнення не підтверджено" / "Release unconfirmed"; Released "Звільнення підтверджено" / "Release confirmed"; Unknown as above. Storage-state keys: None "Не утримується" / "None held"; Retained "Збережено" / "Retained"; DeleteRequested "Видалення запитано" / "Deletion requested"; CleanupPending "Очищення не підтверджено" / "Cleanup unconfirmed"; Deleted "Видалення підтверджено" / "Deletion confirmed"; Unknown as above. Physical storage availability false always uses unknown text, not zero.

## Self-review and handoff

A1–A3 cover the first shared auto-stop observation/resource delivery; A4 covers approved subsequent group/stage retention. Actual lifecycle, snapshot barrier, aggregate authorization/publication, Linux teardown/restore and conservative ledger math belong to backend/Laboratory plans; this plan never duplicates those decisions in browser arithmetic. Every Review Focus condition is pinned to tests above. Consumer integration begins only against the frozen producer fields, with compatibility tests for missing legacy Lab/Group/Observation. Product code and commits remain gated on primary plan review.
