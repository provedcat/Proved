# Proved World Model workflow

Proved keeps business context in Notion and implementation evidence in GitHub. The two systems are connected by one permanent `PWM-####` identifier.

## Boundaries

| System | Source of truth |
|---|---|
| Notion World Model Records | Current rule, problem, decision, rationale, alternatives, business context, evidence state |
| Notion Change Events | Immutable history of what changed, before/after, reason, source, date |
| GitHub Issue | Approved implementation work |
| GitHub Pull Request | Actual code and review evidence |
| Merge or release | Delivery evidence only |

A merged PR means `Delivery = Shipped`. It does not mean `Evidence = Validated`.

Because this repository is public, Issues and PRs must use only the PWM ID. Do not paste private Notion URLs.

## Required lifecycle

1. Capture a meaningful idea, problem, decision, or result in Notion.
2. Search for an existing Record before creating another one.
3. Add a Change Event when the state or current truth changes.
4. Create a GitHub Issue only when an approved Record requires development.
5. Put the PWM ID in the Issue title and body.
6. Link the PR to the Issue and repeat the PWM ID in the PR.
7. After merge, update Notion:
   - GitHub PR URL
   - Delivery State = Shipped
   - Event Type = PR Merged or Released
8. Observe the result separately:
   - Validated
   - Disproved
   - Needs review

## Notion status axes

### Decision State
- Inbox
- Approved
- Deferred
- Rejected
- Superseded

### Delivery State
- Not needed
- Queued
- Building
- Shipped

### Evidence State
- Unverified
- Validated
- Disproved
- Needs review

The key operating view is:

`Approved + Shipped + Unverified`

It shows work that exists in production but still lacks outcome evidence.

## GitHub labels

Keep labels about implementation routing. Do not duplicate Notion decision or evidence states.

### Type
- `type:feature`
- `type:bug`
- `type:design`
- `type:data`
- `type:docs`

### Area
- `area:calculator`
- `area:feed-db`
- `area:feed-registration`
- `area:archive`
- `area:brand`
- `area:analytics`
- `area:platform`

### Priority and flow
- `priority:P0`
- `priority:P1`
- `priority:P2`
- `priority:P3`
- `status:blocked`

## GitHub Project structure

The Project tracks delivery only.

### Fields
- Status: Backlog / Ready / In progress / In review / Done / Blocked
- Priority: P0 / P1 / P2 / P3
- Area: Calculator / Feed Database / Feed Registration / Archive / Brand / Analytics / Platform
- World Model ID: text
- Target: current / next / later

### Views
1. Delivery board — group by Status
2. Priority table — sort by Priority, then updated date
3. Area table — group by Area
4. Blocked — filter Status = Blocked

### Automation
- New Issue added to Project → Backlog
- Assigned Issue → Ready or In progress
- PR linked → In review
- PR merged or Issue closed → Done

## What stays out of GitHub

- Raw chat logs
- Private Notion URLs
- Customer-identifying information
- Content reaction that does not require development
- Rejected or deferred ideas with no implementation work
- Validation claims without observed evidence

## Weekly review

Once a week:

1. Process Notion Inbox.
2. Check approved and queued Records.
3. Check `Approved + Shipped + Unverified`.
4. Add result Events from customer feedback and analytics.
5. Mark superseded rules instead of deleting history.
6. Close or update GitHub work whose delivery state changed.
