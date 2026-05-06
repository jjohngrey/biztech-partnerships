# Code Conventions

## Repository Function Naming

Repository functions in `lib/partnerships/repository.ts` follow a consistent naming convention based on HTTP operations and data patterns:

### Standard CRUD Operations

- **GET (multiple items)** → `list...`
  - Example: `listPartnerAccounts()`, `listEvents()`, `listPipelineDeals()`
  
- **GET (single item)** → `get...`
  - Example: `getMeetingNoteById()`, `getEmailSyncSummary()`
  
- **POST (create)** → `create...`
  - Example: `createDirector()`, `createSponsorship()`, `createEmailTemplate()`
  
- **PUT (update)** → `update...`
  - Example: `updateDirector()`, `updateCompany()`, `updateEmailCampaignStatus()`
  
- **DELETE** → `delete...`
  - Example: `deletePartnerDocument()`, `deleteCompanyInteraction()`

### Special Cases

- **Junction operations** (linking existing records in many-to-many relationships) → `add...` / `remove...`
  - Example: `addPartnerEventRole()`, `removePartnerEventRole()`
  - Example: `addCompanyEventRole()`, `removeCompanyEventRole()`
  - These differ from `create...` because they don't create new standalone records, just relationships

- **Logging operations** (recording events or interactions) → `log...`
  - Example: `logEventPartnerResponse()`, `logEmailInteraction()`
  - These create records but are semantically distinct as audit/tracking operations

## Implementation

These conventions are documented and enforced in `lib/partnerships/repository.ts` at the top of the file:

```typescript
// Naming Conventions:
// GET (multiple) -> list...
// GET (single) -> get...
// POST -> create... (except junction operations use add...)
// PUT -> update...
// DELETE -> delete... (except junction operations use remove...)
// Logging operations -> log...
```
