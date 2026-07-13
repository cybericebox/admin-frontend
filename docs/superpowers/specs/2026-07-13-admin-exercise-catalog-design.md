# Admin Exercise Catalog — Design

**Дата:** 2026-07-13 · **Статус:** утверждено пользователем (brainstorm 3 секции)
**Репозиторий:** admin-frontend, ветка `feature/base-redesign` (коммиты в текущую ветку; чужие незакоммиченные правки не трогать и не стейджить)
**Бэкенд:** AP Backend, роуты `/api/exercises*` готовы (ветка `feature/single-domain-auth-model`)

## 1. Цель

Админский раздел «Завдання» (exercise catalog): каталог с поиском, карточка задания, полный
редактор драфта (варианты → задачи + топология + секреты + файлы), версии и lifecycle
(publish/discard/rollback). Весь объём одной итерацией. UI — украинский (i18n-ключи в
`messages/en.json` + `messages/uk.json`).

## 2. Утверждённые решения

| Решение | Выбор |
|---|---|
| Объём | Всё целиком одним планом |
| Топология | Гибрид: формы — источник правды, рядом read-only SVG-схема; канвас-редактирование позже поверх того же `VisualRender` (сейчас `VisualRender` не пишем) |
| Формы | react-hook-form + zod (`@hookform/resolvers` и `ui/form.tsx` уже в проекте, вводим паттерн) |
| Ветка | Текущая `feature/base-redesign` |
| Компоновка редактора | Табы вариантов сверху + вертикальные секции внутри (Задачи-аккордеон / Топология / Настройки VPN-Internet); одна кнопка «Зберегти чернетку» на весь снапшот |
| State редактора | Один RHF `useForm` на весь `SaveDraftInput`, вложенность через `useFieldArray`; Lexical-поля — controlled-исключения |

## 3. Структура файлов

```
src/app/exercises/page.tsx              каталог (заменяет заглушку)
src/app/exercises/detail/page.tsx       карточка ?id= (identity + версии + lifecycle)
src/app/exercises/draft/page.tsx        редактор драфта ?id= (+ read-only режим версии ?versionId=)
src/api/exercises/catalog.ts            list/get/create/update/delete
src/api/exercises/versions.ts           versions list/get, saveDraft, publish, discard, rollback
src/api/exercises/files.ts              upload (multipart), download URL helper
src/lib/exerciseErrors.ts               словарь FullCode → i18n-ключ
src/lib/exerciseSchemas.ts              zod-схемы (draft snapshot, identity)
src/components/exercises/
  VariantTabs.tsx      TaskAccordion.tsx     TaskForm.tsx
  FlagInput.tsx        PlaceholderList.tsx   AttachmentList.tsx
  TopologySection.tsx  DeviceCard.tsx        InterfaceForm.tsx
  ConnectionList.tsx   TopologyDiagram.tsx   (read-only SVG)
  SecretInput.tsx      NetworkToggles.tsx    VersionsTable.tsx
```

Роутинг static-export-safe: `?id=`/`?versionId=` query-параметры, НЕ `[id]`-сегменты.
Пункт «Завдання» добавляется в `SECTIONS` (`src/components/shell/Sidebar.tsx`) с
`perm: "exercises.read"`; кнопки create/edit/delete/publish скрываются через `can()`
(`exercises.write` / `exercises.delete` / `exercises.publish` — зеркало бэкенд-гейтов).

## 4. API-контракт (бэкенд готов, PascalCase, envelope `{Status, Data}`)

Роуты: `GET/POST /api/exercises`, `GET/PATCH/DELETE /api/exercises/:id`,
`GET :id/versions`, `GET :id/versions/:versionID`, `POST :id/versions/:versionID/rollback`,
`PUT :id/draft`, `DELETE :id/draft`, `POST :id/publish`,
`POST /api/exercises/files` (multipart "file"), `GET /api/exercises/files/:fileID`.

Список: `{Exercises: [{ID, Name, Description, Tags, HasDraft, HasPublished, CreatedAt, UpdatedAt}], NextCursor, HasMore}`;
параметры `search` (подстрока по Name И Description), `tags` (OR-фильтр; пусто → все), `cursor`, `limit`.

`saveDraftRequest`: `{AdminNote, RegenerateFlagsOnPublish, Variants: [variantDTO]}`.

`variantDTO`: `{ID?, Index, Tasks: [taskDTO], Topology: topologyDTO}` — `ID` пустой у нового
варианта (бэк генерит UUIDv7); `Index` — декоративный номер, идентичность = `ID`.

`taskDTO`: `{ID?, Name, Description (Lexical JSON, json.RawMessage), Difficulty
(trivial|easy|medium|hard|insane), Flag []string, LinkedDeviceID?, DeviceFlagVar,
Attachments: [{FileID, Name}], Placeholders: [placeholderDTO]}`.
Семантика `Flag`: `[]`/отсутствует → случайный при развёртывании; 1 значение → фиксированный;
несколько → выбор при развёртывании.

`topologyDTO`: `{VPN: {Enabled, DHCP}, Internet: {Enabled, DHCP}, Devices: [deviceDTO],
Connections: [{Endpoints: [{Kind: device|vpn|internet, DeviceID?, Interface?}] (ровно 2)}],
VisualRender?}`.

`deviceDTO`: `{ID?, Name (DNS label), Type (container|vm|switch|hub), Image,
Interfaces: [{Name, MAC?, IP: {Type: static|dhcp|none, Addresses [CIDR]?, Gateway?}}],
EnvVars: [{Name, Value, Secret, HasValue}], External?: {Port, Protocol http|https}}`.
Свитчи/хабы не имеют Image/Interfaces/EnvVars/External.

`envVarDTO`-контракт секретов: `Value` write-only — в ответах пустой, `HasValue=true` если
значение хранится; пустой `Value` при сохранении = «оставить сохранённое».

`versionResponse`: `{ID, ExerciseID, Status (draft|published|unpublished), AdminNote,
RegenerateFlagsOnPublish, Variants, CreatedAt, CreatedBy, PublishedAt}`; list-item — то же без
Variants + `VariantCount`.

## 5. Каталог (page.tsx)

Паттерн `users/page.tsx`: raw `<table>`, cursor + IntersectionObserver infinite scroll
(PAGE=50), поиск с debounce 300ms, фильтр тегов (multi-chip ввод; выбранные теги → `tags=` OR).
Колонки: назва, теги (chips), статус (чернетка/опубліковано — из HasDraft/HasPublished),
оновлено. Создание — диалог (Name/Description/Tags, RHF+zod) → POST → переход на detail.
Строка → `/exercises/detail?id=`.

## 6. Карточка (detail/page.tsx)

- Identity-форма: назва (3–50), опис (≤2000), теги (≤20, 1–30 симв.) — RHF+zod, PATCH.
  Конфликт 409 (`ErrExerciseModified`) → alert «дані змінилися, оновіть сторінку».
- Статус-блок: есть ли чернетка/публикация, кнопки «Редагувати чернетку» (создастся при первом
  сохранении, если нет), «Опублікувати» (confirm), «Відхилити чернетку» (confirm).
- `VersionsTable`: статус, дата, автор (резолв имён — паттерн `lib/userNames`), variantCount,
  AdminNote; действия: чернетка → редагувати/опублікувати/відхилити; unpublished →
  «Відкотитися» (POST rollback; 409 `ErrDraftAlreadyExists` → словами); любая → «Переглянути»
  (draft/page.tsx?versionId= read-only).
- Удаление задания — confirm-диалог с предупреждением о версиях.

## 7. Редактор драфта (draft/page.tsx)

Один `useForm<DraftFormValues>` на весь снапшот (zod-схема `exerciseSchemas.ts`), табы
вариантов (`useFieldArray` по Variants; добавить/удалить вариант; заголовок таба — «Варіант
{Index}»). Внутри варианта секции:

1. **Задачи** — аккордеон (`useFieldArray` Tasks): назва, складність (select), опис —
   `RichTextEditor` (Lexical JSON в поле формы через Controller), `FlagInput` (список значений
   + подпись семантики 0/1/N), привязка: select устройства ИЗ ТОПОЛОГИИ ТЕКУЩЕГО варианта
   (LinkedDeviceID) + DeviceFlagVar, `AttachmentList` (upload → POST files, прогресс, лимит с
   бэка; скачивание по `GET files/:id`), `PlaceholderList` (kind-select + поля по виду).
2. **Топология** — `DeviceCard` (grid): для switch/hub только имя+тип; для container/vm — image,
   интерфейсы (`InterfaceForm`: имя, MAC, IPConfig type + CIDR-адреса при static + gateway),
   EnvVars (`SecretInput` для секретов), External (port/protocol). `ConnectionList`: пары
   select «устройство/интерфейс | VPN | Internet». Справа/снизу `TopologyDiagram` — самописный
   read-only SVG (устройства узлами, свитчи квадратами, связи линиями, VPN/Internet бейджами),
   пересчёт из значений формы (`useWatch`), детерминированная раскладка (круг/грид), без
   внешних библиотек. `VisualRender` не читаем и не пишем (зарезервирован под будущий канвас).
3. **Настройки** — `NetworkToggles` (VPN/Internet Enabled+DHCP), AdminNote,
   RegenerateFlagsOnPublish (checkbox с подсказкой).

Кнопка «Зберегти чернетку» — сериализация формы 1:1 в `PUT :id/draft`; `formState.isDirty` →
предупреждение при уходе. Read-only режим (`?versionId=`): те же компоненты с `disabled`,
без кнопок; секреты приходят замаскированными.

**Zod-валидация (зеркало домена, до запроса):** имя задания/задачи 3–50; DNS label
`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`; MAC — regex 6 октетов; CIDR — regex + parse-check;
port 1–65535; protocol enum; static → ≥1 адрес, non-static → без адресов; gateway только при
static; вариант ≥1 задачи; у всех вариантов равное число задач (superRefine на снапшоте —
доменный инвариант `ErrTaskCountMismatch`).

## 8. Ошибки

`src/lib/exerciseErrors.ts`: словарь FullCode → i18n-ключ для доменных ошибок exercise/media
(валидация топологии: unresolved endpoint, port in use, duplicate device name, VPN/Internet
disabled/in-use; placeholders; flags; конфликты: modified, draft-already-exists, no-draft;
file too large). Неизвестный код → generic-сообщение + `Status.Message` бэка. Ошибка publish
показывается на карточке блоком с расшифровкой. 401/403 — существующий `client.ts` (silent
SSO + redirect), не трогаем.

## 9. Тесты (vitest + Testing Library, образец — notifications)

- API-клиенты: normalize (nullable поля, envelope unwrap), построение query.
- `exerciseSchemas`: табличные тесты DNS/MAC/CIDR/port/flag/superRefine.
- `FlagInput` (семантика 0/1/N), `SecretInput` (write-only, HasValue, «замінити»),
  `TopologyDiagram` (устройства/связи из снапшота), `PlaceholderList` (поля по kind).
- Каталог: рендер списка, поиск-debounce, фильтр тегов (msw/фейк apiGet — как в users-тестах).
- Редактор: форма → `saveDraftRequest` 1:1 (сериализация), read-only режим.

## 10. Вне объёма

Канвас-редактирование топологии (пишущий VisualRender), тестовая лаборатория/деплой, связка с
ивентами, пользовательский API, AND-семантика тегов, Range-докачка файлов.

## 11. Порядок работ (для плана)

1. API-клиенты + типы + normalize + тесты
2. zod-схемы + тесты
3. Каталог (список, поиск, теги, создание) + nav + i18n-ключи
4. Карточка: identity + удаление
5. Версии/lifecycle на карточке (таблица, publish/discard/rollback, конфликты)
6. Каркас редактора: RHF-форма, табы вариантов, save, dirty-guard, read-only режим
7. Задачи: TaskForm + Lexical + FlagInput + PlaceholderList
8. Файлы: AttachmentList (upload/download)
9. Топология: DeviceCard/InterfaceForm/ConnectionList + NetworkToggles
10. TopologyDiagram (SVG)
11. Секреты: SecretInput + интеграция
12. Ошибки (exerciseErrors) + i18n-полировка
13. Финальная верификация: `npm run lint && npm run test && npm run build`
