# Forms System Migration Specification

## Overview

The forms system allows creation of custom forms that groups and events can use to collect information from users. The system supports three main types of forms:

1. **Template Forms** - Reusable form templates
2. **Event Forms** - Forms attached to events (surveys and evaluations)
3. **Group Forms** - Forms created and managed by groups

---

## Data Models

### 1. Form (Base Polymorphic Model)

Base model for all form types using Django polymorphic.

**Fields:**

- `id` (UUID, Primary Key)
- `title` (String, max 400 chars)
- `description` (Text, optional)
- `template` (Boolean, default: false)

**Polymorphic Types:**

- `Form` (base type)
- `EventForm`
- `GroupForm`

**Relations:**

- Has many `Field` (one-to-many)
- Has many `Submission` (one-to-many)

**Computed Properties:**

- `website_url` - Returns `/sporreskjema/{id}/`
- `viewer_has_answered` - Boolean indicating if current user has submitted

---

### 2. EventForm (extends Form)

Forms associated with events, used for surveys and evaluations.

**Additional Fields:**

- `event` (Foreign Key to Event, CASCADE)
- `type` (Choice Field)
  - `SURVEY` - Survey form
  - `EVALUATION` - Post-event evaluation form

**Constraints:**

- Unique together: (`event`, `type`) - Each event can have only one survey and one evaluation

**Business Rules:**

- Evaluation forms can only be accessed by users who attended the event or have event permissions
- Survey forms are publicly accessible
- Users can update their submission before event registration
- After registration, submissions cannot be modified
- Submissions are filtered to only show users who are not on waitlist

---

### 3. GroupForm (extends Form)

Forms created by groups for collecting information from members or public.

**Additional Fields:**

- `group` (Foreign Key to Group, CASCADE)
- `email_receiver_on_submit` (Email, optional) - Receives notification on new submission
- `can_submit_multiple` (Boolean, default: true) - Allow multiple submissions per user
- `is_open_for_submissions` (Boolean, default: false) - Controls if form accepts submissions
- `only_for_group_members` (Boolean, default: false) - Restrict submissions to group members

**Business Rules:**

- Only group leaders and admins can create/edit group forms
- Email notification sent when `email_receiver_on_submit` is set
- Validates submission permissions based on `only_for_group_members` flag
- Enforces single submission when `can_submit_multiple` is false

---

### 4. Field (Ordered Model)

Individual questions/fields within a form.

**Fields:**

- `id` (UUID, Primary Key)
- `title` (String, max 400 chars)
- `form` (Foreign Key to Form, CASCADE)
- `type` (Choice Field)
  - `TEXT_ANSWER` - Free text response
  - `MULTIPLE_SELECT` - Multiple choice (multiple selections)
  - `SINGLE_SELECT` - Multiple choice (single selection)
- `required` (Boolean, default: false)
- `order` (Integer) - Display order within form

**Relations:**

- Belongs to `Form`
- Has many `Option` (one-to-many)
- Has many `Answer` (one-to-many)

**Ordering:**

- Ordered with respect to parent form
- Uses OrderedModel for position management

---

### 5. Option (Ordered Model)

Available choices for select-type fields.

**Fields:**

- `id` (UUID, Primary Key)
- `title` (String, max 400 chars)
- `field` (Foreign Key to Field, CASCADE)
- `order` (Integer) - Display order within field

**Relations:**

- Belongs to `Field`
- Has many `Answer` through M2M (many-to-many)

**Ordering:**

- Ordered with respect to parent field
- Uses OrderedModel for position management

---

### 6. Submission

User's submission/response to a form.

**Fields:**

- `id` (UUID, Primary Key)
- `form` (Foreign Key to Form, CASCADE)
- `user` (Foreign Key to User, CASCADE)
- `created_at` (DateTime, auto)
- `updated_at` (DateTime, auto)

**Relations:**

- Belongs to `Form`
- Belongs to `User`
- Has many `Answer` (one-to-many)

**Validation Rules:**

- Prevents duplicate submissions based on form type:
  - Event forms: Cannot modify after registration, deletes and replaces before registration
  - Group forms: Blocks duplicates if `can_submit_multiple` is false
  - Base forms: Blocks all duplicates
- Group forms: Validates form is open for submissions
- Group forms: Validates user membership if `only_for_group_members` is true

**Side Effects:**

- Sends email notification if GroupForm has `email_receiver_on_submit` configured
- Email includes submitter name and link to group page

---

### 7. Answer

Individual answer to a field within a submission.

**Fields:**

- `id` (UUID, Primary Key)
- `submission` (Foreign Key to Submission, CASCADE)
- `field` (Foreign Key to Field, nullable)
- `selected_options` (Many-to-Many to Option, optional)
- `answer_text` (Text, optional, default: "")
- `created_at` (DateTime, auto)
- `updated_at` (DateTime, auto)

**Relations:**

- Belongs to `Submission`
- Belongs to `Field`
- Has many `Option` through M2M (many-to-many for select-type answers)

**Business Rules:**

- Either `selected_options` or `answer_text` must be populated (not both)
- `selected_options` used for MULTIPLE_SELECT and SINGLE_SELECT fields
- `answer_text` used for TEXT_ANSWER fields

---

## API Endpoints

### Form Management

#### 1. List Forms

```
GET /forms/
```

**Query Parameters:**

- `all` - Include all forms (not just templates)

**Permissions:**

- Authenticated users only
- Group forms require group list permissions
- Non-group forms require admin access

**Response:**

- Returns template forms by default (template=true)
- Returns polymorphic serializer with resource_type
- Includes `viewer_has_answered` computed field

---

#### 2. Create Form

```
POST /forms/
```

**Request Body:**

```json
{
  "resource_type": "EventForm|GroupForm|Form",
  "title": "string (max 400)",
  "description": "string (optional)",
  "template": false,
  "fields": [
    {
      "title": "string",
      "type": "TEXT_ANSWER|MULTIPLE_SELECT|SINGLE_SELECT",
      "required": false,
      "order": 0,
      "options": [
        {
          "title": "string",
          "order": 0
        }
      ]
    }
  ],
  // EventForm specific
  "event": "uuid",
  "type": "SURVEY|EVALUATION",
  // GroupForm specific
  "group": "slug",
  "can_submit_multiple": true,
  "is_open_for_submissions": false,
  "only_for_group_members": false,
  "email_receiver_on_submit": "email@example.com"
}
```

**Permissions:**

- Event forms: Requires write permission on the event
- Group forms: Requires group form permission or leader status
- Base forms: Requires admin access

**Response:**

- Returns created form with fields and options
- Includes polymorphic type information

---

#### 3. Retrieve Form

```
GET /forms/{id}/
```

**Permissions:**

- Authenticated users only
- Event evaluations: Only attendees or event organizers
- Group forms: Follows group form visibility rules

**Response:**

- Full form details with fields and options
- Includes `viewer_has_answered` flag

---

#### 4. Update Form

```
PUT/PATCH /forms/{id}/
```

**Request Body:** Same as create, all fields optional for PATCH

**Field/Option Update Logic:**

- Fields/options with `id`: Updates existing
- Fields/options without `id`: Creates new
- Fields/options not in request: Deleted
- Order can be updated via `order` field

**Permissions:**

- Event forms: Requires event write permission
- Group forms: Requires group form permission
- Base forms: Requires admin access

**Response:**

- Updated form with all fields and options

---

#### 5. Delete Form

```
DELETE /forms/{id}/
```

**Permissions:**

- Same as update permissions

**Response:**

```json
{
  "detail": "Skjemaet ble slettet"
}
```

**Side Effects:**

- Cascades to fields, options, submissions, and answers

---

#### 6. Get Form Statistics

```
GET /forms/{id}/statistics/
```

**Permissions:**

- Event forms: Event organizers only
- Group forms: Group form managers only
- Base forms: Admin only

**Response:**

```json
{
  "id": "uuid",
  "title": "string",
  "resource_type": "string",
  "statistics": [
    {
      "id": "uuid",
      "title": "Field title",
      "type": "MULTIPLE_SELECT|SINGLE_SELECT",
      "required": false,
      "options": [
        {
          "id": "uuid",
          "title": "Option title",
          "answer_amount": 5,
          "answer_percentage": 25.5
        }
      ]
    }
  ]
}
```

**Notes:**

- Only includes fields with options (excludes TEXT_ANSWER fields)
- Percentages calculated from total submissions

---

### Submission Management

#### 7. Create Submission

```
POST /forms/{form_id}/submissions/
```

**Request Body:**

```json
{
  "answers": [
    {
      "field": {
        "id": "uuid"
      },
      "answer_text": "string (for TEXT_ANSWER)",
      "selected_options": [
        {
          "id": "uuid"
        }
      ]
    }
  ]
}
```

**Validation:**

- Cannot have both `answer_text` and `selected_options`
- Validates required fields
- Event evaluations: Must have attended event
- Group forms: Validates submission permissions

**Permissions:**

- Authenticated users only
- Additional restrictions based on form type

**Response:**

- Created submission with answers
- User details included

**Side Effects:**

- Email sent if GroupForm has email_receiver_on_submit
- Replaces previous submission for event forms (before registration)

---

#### 8. List Submissions

```
GET /forms/{form_id}/submissions/
```

**Permissions:**

- Form must have write permission (organizers/managers)

**Response:**

- Paginated list of submissions
- Includes user details and answers
- Event forms: Filtered to non-waitlist participants

---

#### 9. Retrieve Submission

```
GET /forms/{form_id}/submissions/{id}/
```

**Permissions:**

- Own submission OR form write permission

**Response:**

- Full submission details with answers and user info

---

#### 10. Download Submissions (CSV)

```
GET /forms/{form_id}/submissions/download/
```

**Headers:**

- `Accept: text/csv` (required)

**Permissions:**

- Form write permission (organizers/managers)

**Response:**

- CSV file with columns:
  - first_name
  - last_name
  - full_name
  - email
  - study
  - studyyear
  - [Dynamic columns for each form field]

**Notes:**

- Multiple select answers joined with ", "
- Text answers have newlines replaced with spaces
- Event forms: Only includes non-waitlist participants

---

#### 11. Delete Submission with Reason

```
DELETE /forms/{form_id}/submissions/{id}/destroy_with_reason/
```

**Request Body:**

```json
{
  "reason": "string (required, non-empty)"
}
```

**Permissions:**

- Admin only

**Response:**

```json
{
  "detail": "Skjemaet er slettet og brukeren er varslet."
}
```

**Side Effects:**

- Sends email to submitter with deletion reason
- Permanently deletes submission and answers

---

### Group Form Endpoints

#### 12. List Group Forms

```
GET /groups/{slug}/forms/
```

**Permissions:**

- Group leaders/admins: See all forms
- Group members: See open forms only
- Public: See open, non-member-only forms

**Response:**

- List of group forms with full details
- Filtered based on user permissions

---

## Permission Matrix

### Form Permissions

| Action     | Template Form | Event Form                               | Group Form                      |
| ---------- | ------------- | ---------------------------------------- | ------------------------------- |
| List       | Admin/NOK     | Admin/NOK                                | TIHLDE members                  |
| Create     | Admin/NOK     | Event write permission                   | Group form permission or leader |
| Retrieve   | Authenticated | Public (Survey) / Attendees (Evaluation) | Based on submission settings    |
| Update     | Admin/NOK     | Event write permission                   | Group form permission           |
| Delete     | Admin/NOK     | Event write permission                   | Group form permission           |
| Statistics | Admin/NOK     | Event write permission                   | Group form permission           |

### Submission Permissions

| Action             | Event Form                                 | Group Form                              |
| ------------------ | ------------------------------------------ | --------------------------------------- |
| Create             | Authenticated (Evaluation: attendees only) | Based on form settings                  |
| List               | Event write permission                     | Form write permission                   |
| Retrieve           | Own submission or form write permission    | Own submission or form write permission |
| Download           | Event write permission                     | Form write permission                   |
| Delete with reason | Admin                                      | Admin                                   |

---

## Business Logic & Validation

### Duplicate Submission Handling

1. **Event Forms:**

   - Before registration: Deletes old submission, creates new one
   - After registration: Rejects with error

2. **Group Forms:**

   - If `can_submit_multiple = true`: Allows new submission
   - If `can_submit_multiple = false`: Rejects with error

3. **Base Forms:**
   - Always rejects duplicate submissions

### Group Form Submission Validation

1. Check `is_open_for_submissions = true`, else reject
2. If `only_for_group_members = true`, check user membership
3. Check duplicate submission rules

### Event Form Access Control

1. **Survey forms:**

   - Publicly accessible for reading
   - Anyone can submit (authenticated)

2. **Evaluation forms:**
   - Only attendees can read and submit
   - Event organizers can always access

### Field/Option Ordering

- Uses OrderedModel for drag-and-drop reordering
- Order preserved when updating
- New items without order appended to end

---

## Integration Points

### Event Integration

- Events can have one SURVEY and one EVALUATION form
- Event model provides `event.survey` and `event.evaluation` properties
- Submissions linked to event registrations
- Registration deletion triggers submission deletion

### Group Integration

- Groups can have multiple forms
- Group leaders/admins manage forms
- Member-only restriction available
- Submissions filtered by group membership

### User Integration

- User model has `submissions` relation
- GDPR export includes all form submissions
- User deletion cascades to submissions

---

## Exceptions & Error Handling

### Custom Exceptions

1. **DuplicateSubmission (409 Conflict)**

   - Message: "Spørreskjemaet tillater kun én innsending"
   - Thrown when duplicate submission rules violated

2. **FormNotOpenForSubmission (403 Forbidden)**

   - Message: "Spørreskjemaet er ikke åpent for innsending"
   - Thrown when group form is closed

3. **GroupFormOnlyForMembers (403 Forbidden)**
   - Message: "Spørreskjemaet er kun åpent for medlemmer av gruppen"
   - Thrown when non-member tries to submit member-only form

---

## Email Notifications

### Group Form Submission Email

**Trigger:** New submission to GroupForm with `email_receiver_on_submit` set

**Recipient:** Email address in `email_receiver_on_submit`

**Content:**

- Subject: "Nytt spørreskjema svar"
- Body: "{first_name} {last_name} har besvart spørreskjemaet "{form_title}""
- Button: "Se spørreskjema" → Links to group website

### Submission Deletion Email

**Trigger:** Admin deletes submission with reason

**Recipient:** Submission owner's email

**Content:**

- Subject: "Ditt svar på spørreskjemaet har blitt slettet"
- Body: "Ditt svar på spørreskjemaet {form_title} har blitt slettet av en administrator. Grunnen er: {reason}"

---

## Database Schema Notes

### Polymorphic Implementation

- Uses `django-polymorphic` package
- Base table: `forms_form`
- Child tables: `forms_eventform`, `forms_groupform`
- Automatic type resolution via `polymorphic_ctype`

### Ordering Implementation

- Uses `django-ordered-model` package
- Provides `order` field and reordering methods
- Scoped to parent: Fields ordered within Form, Options within Field

### Cascade Behavior

- Form deletion → Deletes Fields, Options, Submissions, Answers
- Field deletion → Deletes Options, Answers
- Submission deletion → Deletes Answers
- User deletion → Deletes Submissions → Deletes Answers
- Event deletion → Deletes EventForms → Deletes Submissions
- Group deletion → Deletes GroupForms → Deletes Submissions

---

## Technical Dependencies

### Python Packages

- `django-polymorphic` - Polymorphic model support
- `django-ordered-model` - Ordering support for fields/options
- `djangorestframework-csv` - CSV export renderer

### Related Apps

- `app.content` - Event and User models
- `app.group` - Group model and permissions
- `app.common` - Base models and permissions

---

## Migration Checklist

### Data Migration

- [ ] Export all forms with fields and options
- [ ] Export all submissions with answers
- [ ] Preserve ordering of fields and options
- [ ] Maintain polymorphic type information
- [ ] Include all metadata (timestamps, permissions)

### Feature Parity

- [ ] Form CRUD operations
- [ ] Field and option management with ordering
- [ ] Submission creation and validation
- [ ] Template form system
- [ ] Event form integration (Survey/Evaluation)
- [ ] Group form management
- [ ] Permission system for all form types
- [ ] Email notifications
- [ ] CSV export functionality
- [ ] Statistics generation
- [ ] GDPR data export

### Testing Requirements

- [ ] Duplicate submission prevention
- [ ] Permission checks for all actions
- [ ] Event form attendance validation
- [ ] Group form membership validation
- [ ] Field/option ordering
- [ ] Email delivery
- [ ] CSV export format
- [ ] Statistics calculation accuracy

---

## Notes for New System

### Key Design Patterns

1. **Polymorphic inheritance** for different form types
2. **Ordered models** for field/option positioning
3. **Permission-based access control** at model level
4. **Nested serializer updates** with create/update/delete logic
5. **Validation in model layer** with custom exceptions

### Potential Improvements

- Consider GraphQL for nested field/option updates
- Add form versioning for edit history
- Support file uploads in answers
- Add conditional field logic (show/hide based on answers)
- Support form duplication/cloning
- Add form analytics/insights beyond basic statistics
- Support rich text in descriptions and answers
- Add field validation rules (regex, min/max length, etc.)
