export namespace Schemas {
  // <Schemas>
  export type Version = {
    /**
     * Release tag the image was built from, e.g. '2026-08-22.release-1'. 'unknown' when the image did not come from the release pipeline.
     */
    version: string;
    /**
     * Commit the image was built from, or 'unknown' outside the release pipeline.
     */
    commit: string;
    /**
     * When this process booted (ISO 8601).
     */
    startedAt: string;
    /**
     * Seconds since this process booted.
     */
    uptimeSeconds: number;
  };
  export type CreateApiKeyResponse = {
    /**
     * API key ID
     */
    id: string;
    /**
     * Name of the API key
     */
    name: string;
    /**
     * Description of the API key
     */
    description: string;
    /**
     * First 12 characters of the key for display
     */
    keyPrefix: string;
    /**
     * User ID who created this key
     */
    createdById: string | null;
    /**
     * When the key was last used
     */
    lastUsedAt: string | null;
    /**
     * Array of permissions granted to this API key
     */
    permissions: Array<string>;
    /**
     * Optional metadata as key-value pairs
     */
    metadata: Record<string, unknown> | null;
    /**
     * When the key was created
     */
    createdAt: string;
    /**
     * When the key was last updated
     */
    updatedAt: string;
    /**
     * The full API key - ONLY returned on creation and regeneration. Cannot be retrieved again.
     */
    key: string;
  };
  export type HTTPAppException = {
    /**
     * The HTTP status code
     */
    status: number;
    /**
     * The error message
     */
    message: string;
    /**
     * Additional metadata about the error
     */
    meta?: unknown;
  };
  export type CreateApiKey = {
    /**
     * Name for the API key
     */
    name: string;
    /**
     * Detailed description of the API key's purpose
     */
    description: string;
    /**
     * Array of permissions granted to this API key (e.g., ['email:send', 'news:create']). Service validates against allowed permissions.
     */
    permissions: Array<string>;
    /**
     * Optional metadata as key-value pairs
     */
    metadata?: Record<string, unknown>;
  };
  /**
   * The API key details and permissions if valid. Undefined if invalid.
   */
  export type ApiKey = {
    /**
     * API key ID
     */
    id: string;
    /**
     * Name of the API key
     */
    name: string;
    /**
     * Description of the API key
     */
    description: string;
    /**
     * First 12 characters of the key for display
     */
    keyPrefix: string;
    /**
     * User ID who created this key
     */
    createdById: string | null;
    /**
     * When the key was last used
     */
    lastUsedAt: string | null;
    /**
     * Array of permissions granted to this API key
     */
    permissions: Array<string>;
    /**
     * Optional metadata as key-value pairs
     */
    metadata: Record<string, unknown> | null;
    /**
     * When the key was created
     */
    createdAt: string;
    /**
     * When the key was last updated
     */
    updatedAt: string;
  };
  export type ApiKeyList = Array<ApiKey>;
  export type UpdateApiKey = Partial<{
    /**
     * Name for the API key
     */
    name: string;
    /**
     * Detailed description of the API key's purpose
     */
    description: string;
    /**
     * Array of permissions granted to this API key
     */
    permissions: Array<string>;
    /**
     * Optional metadata as key-value pairs
     */
    metadata: Record<string, unknown>;
  }>;
  export type DeleteApiKeyResponse = {
    /**
     * Success message
     */
    message: string;
  };
  export type ValidateApiKeyResponse = {
    /**
     * Whether the API key is valid
     */
    valid: boolean;
    apiKey?: ApiKey;
  };
  export type ValidateApiKeyInput = {
    /**
     * The API key to validate
     */
    key: string;
  };
  export type ApplicationOptions = {
    /**
     * Groups selectable as the applying group
     */
    groups: Array<{ slug: string; name: string }>;
    /**
     * Groups with an økonomiansvarlig address
     */
    ccOptions: Array<{ slug: string; name: string; email: string }>;
    budgetTypes: Array<{
      value: "social_budget" | "group_budget" | "approved_hs_application" | "approved_idkom_application";
      label: string;
    }>;
    caseTypes: Array<{ value: "discussion" | "decision" | "orientation"; label: string }>;
  };
  export type ApplicationSummary = {
    id: string;
    type: "expense" | "support" | "sports_support" | "hs_case" | "company_contact";
    /**
     * Norwegian type label
     */
    typeLabel: string;
    status: "new" | "in_progress" | "approved" | "rejected";
    /**
     * Norwegian status label
     */
    statusLabel: string;
    /**
     * Short human title — the case name, or the group and amount
     */
    title: string;
    contactName: string;
    contactEmail: string;
    submittedById: string | null;
    submittedByName: string | null;
    /**
     * Amount for expense/support types, otherwise null
     */
    amountNok: number | null;
    groupName: string | null;
    hasPdf: boolean;
    handledByName: string | null;
    handledAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  export type ApplicationList = Array<ApplicationSummary>;
  export type CreateApplicationResponse = {
    id: string;
    /**
     * False when PDF rendering failed; the submission was still saved and an admin can regenerate it.
     */
    pdfGenerated: boolean;
  };
  export type CreateExpenseApplication = {
    /**
     * Full name of the person submitting
     */
    contactName: string;
    /**
     * Contact email address
     */
    contactEmail: string;
    /**
     * Optional copy to a group's økonomiansvarlig. Must match a group's registered finance address.
     */
    ccEmail?: string;
    /**
     * Amount in NOK, at most two decimals (øre)
     */
    amountNok: number;
    /**
     * Date of the expense, YYYY-MM-DD
     */
    expenseDate: string;
    /**
     * Slug of the group the expense belongs to
     */
    groupSlug: string;
    /**
     * Which budget the expense is drawn from
     */
    budgetType: "social_budget" | "group_budget" | "approved_hs_application" | "approved_idkom_application";
    /**
     * What the expense is for
     */
    description: string;
    /**
     * Norwegian account number, xxxx.xx.xxxxx
     */
    accountNumber: string;
    /**
     * Receipt images, at least one
     */
    attachmentKeys: Array<string>;
  };
  export type CreateSupportApplication = {
    /**
     * Full name of the person submitting
     */
    contactName: string;
    /**
     * Contact email address
     */
    contactEmail: string;
    /**
     * Slug of the group applying
     */
    groupSlug: string;
    /**
     * Purpose of the application
     */
    purpose: string;
    /**
     * Description of the event or product
     */
    eventDescription: string;
    /**
     * Why the support is needed
     */
    justification: string;
    /**
     * Total amount applied for, in whole NOK
     */
    totalAmountNok: number;
    /**
     * Optional link to a budget document
     */
    budgetLink?: string;
    /**
     * Optional closing summary
     */
    summary?: string;
    /**
     * Budget documentation images
     */
    attachmentKeys: Array<string>;
  };
  export type CreateHsCaseApplication = {
    /**
     * Full name of the person submitting
     */
    contactName: string;
    /**
     * Contact email address
     */
    contactEmail: string;
    /**
     * Name of the case
     */
    caseName: string;
    /**
     * Kind of case
     */
    caseType: "discussion" | "decision" | "orientation";
    /**
     * Background for the case
     */
    background: string;
    /**
     * The case handler's assessment
     */
    assessment: string;
    /**
     * The case handler's recommendation. Required for a Vedtakssak.
     */
    recommendation?: string;
    /**
     * Optional attachments
     */
    attachmentKeys: Array<string>;
  };
  export type RegenerateApplicationPdfResponse = { pdfAssetKey: string };
  export type ApplicationDetail = {
    id: string;
    type: "expense" | "support" | "sports_support" | "hs_case" | "company_contact";
    /**
     * Norwegian type label
     */
    typeLabel: string;
    status: "new" | "in_progress" | "approved" | "rejected";
    /**
     * Norwegian status label
     */
    statusLabel: string;
    /**
     * Short human title — the case name, or the group and amount
     */
    title: string;
    contactName: string;
    contactEmail: string;
    submittedById: string | null;
    submittedByName: string | null;
    /**
     * Amount for expense/support types, otherwise null
     */
    amountNok: number | null;
    groupName: string | null;
    hasPdf: boolean;
    handledByName: string | null;
    handledAt: string | null;
    createdAt: string;
    updatedAt: string;
    signature: string;
    internalComment?: string | null;
    attachments: Array<{ id: string; assetKey: string; kind: "receipt" | "budget" | "attachment"; sortOrder: number }>;
    expense: {
      ccEmail: string | null;
      amountNok: number;
      expenseDate: string;
      budgetType: "social_budget" | "group_budget" | "approved_hs_application" | "approved_idkom_application";
      budgetTypeLabel: string;
      description: string;
      accountNumber: string;
      group: { slug: string; name: string };
    } | null;
    support: {
      purpose: string;
      eventDescription: string;
      justification: string;
      totalAmountNok: number;
      budgetLink: string | null;
      summary: string | null;
      group: { slug: string; name: string };
    } | null;
    hsCase: {
      caseName: string;
      caseType: "discussion" | "decision" | "orientation";
      caseTypeLabel: string;
      background: string;
      assessment: string;
      recommendation: string | null;
    } | null;
    companyContact: {
      company: string;
      eventTypes: Array<string>;
      semesters: Array<string>;
      comment: string | null;
    } | null;
  };
  export type UpdateApplicationStatus = {
    /**
     * New processing status
     */
    status: "new" | "in_progress" | "approved" | "rejected";
    /**
     * Handler-only note. Never shown to the submitter.
     */
    internalComment?: string | null;
    /**
     * Optional message included in the decision email sent to the submitter.
     */
    messageToSubmitter?: string;
  };
  export type UploadResponse = {
    /**
     * The unique key to reference this asset
     */
    key: string;
    /**
     * The original filename
     */
    originalFilename: string;
    /**
     * The MIME type of the file
     */
    contentType: string | null;
    /**
     * File size in bytes
     */
    size: number;
    /**
     * Asset status
     */
    status: "staged" | "ready";
  };
  export type AssetMetadata = {
    /**
     * Asset ID
     */
    id: string;
    /**
     * The unique key to reference this asset
     */
    key: string;
    /**
     * The original filename
     */
    originalFilename: string;
    /**
     * The MIME type of the file
     */
    contentType: string | null;
    /**
     * File size in bytes
     */
    size: number;
    /**
     * Asset status
     */
    status: "staged" | "ready";
    /**
     * When the asset was promoted
     */
    promotedAt: string | null;
    /**
     * When the asset was created
     */
    createdAt: string;
  };
  export type VisibleBanner = {
    /**
     * Banner ID
     */
    id: string;
    /**
     * Banner headline
     */
    title: string;
    /**
     * Short message shown in the banner
     */
    description: string;
    /**
     * Optional link for the banner
     */
    url: string | null;
    /**
     * Optional label for the banner link
     */
    linkText: string | null;
    /**
     * Whether the banner link opens in a new tab
     */
    openInNewTab: boolean;
    /**
     * Visibility window end (ISO 8601)
     */
    visibleUntil: string;
  };
  /**
   * Banners currently live, newest first
   */
  export type VisibleBannerList = Array<VisibleBanner>;
  export type Banner = {
    /**
     * Banner ID
     */
    id: string;
    /**
     * Banner headline
     */
    title: string;
    /**
     * Short message shown in the banner
     */
    description: string;
    /**
     * Optional link for the banner
     */
    url: string | null;
    /**
     * Optional label for the banner link
     */
    linkText: string | null;
    /**
     * Whether the banner link opens in a new tab
     */
    openInNewTab: boolean;
    /**
     * Visibility window start (ISO 8601)
     */
    visibleFrom: string;
    /**
     * Visibility window end (ISO 8601)
     */
    visibleUntil: string;
    /**
     * Whether the banner is live right now
     */
    isVisible: boolean;
    /**
     * Creator user ID
     */
    createdById: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
  };
  /**
   * All banners, newest visibility first
   */
  export type BannerList = Array<Banner>;
  export type CreateBanner = {
    /**
     * Banner headline
     */
    title: string;
    /**
     * Short message shown in the banner
     */
    description: string;
    /**
     * Optional link for the banner
     */
    url?: string;
    /**
     * Optional label for the banner link; an arrow is always shown
     */
    linkText?: string;
    /**
     * Whether the banner link opens in a new tab. Defaults to true.
     */
    openInNewTab?: boolean;
    /**
     * When the banner becomes visible
     */
    visibleFrom: string;
    /**
     * When the banner stops being visible
     */
    visibleUntil: string;
  };
  export type UpdateBanner = Partial<{
    title: string;
    description: string;
    url: string | null;
    linkText: string | null;
    openInNewTab: boolean;
    visibleFrom: string;
    visibleUntil: string;
  }>;
  export type DeleteBannerResponse = { message: string };
  export type AccountLinkHelpResponse = { success: boolean; message: string };
  export type AccountLinkHelp = {
    /**
     * Name as Feide reported it
     */
    feideName: string;
    /**
     * NTNU username from the Feide login
     */
    feideUsername?: string;
    /**
     * Where to reach the member
     */
    contactEmail: string;
    /**
     * What they remember about the old account
     */
    note?: string;
  };
  export type AccountLinkSyncResponse = { success: boolean };
  export type CompanyContactResponse = { success: boolean; message: string };
  export type CompanyContact = {
    /**
     * Name of the company reaching out
     */
    company: string;
    /**
     * Name of the person to reply to
     */
    contactName: string;
    /**
     * Email address to reply to
     */
    contactEmail: string;
    /**
     * Event formats the company is interested in
     */
    eventTypes: Array<string>;
    /**
     * Semesters the company is available in
     */
    semesters: Array<string>;
    /**
     * Free-text message from the company
     */
    comment?: string;
  };
  export type SendEmailResponse = { success: boolean; message: string; recipientCount: number };
  export type SendCustomEmail = {
    /**
     * Recipient email address (string) or list of recipient email addresses (array)
     */
    to: string | Array<string>;
    /**
     * Addresses to put on copy. Note that the API sends one email per `to` recipient, so a Cc address receives one copy per recipient.
     */
    cc?: Array<string>;
    /**
     * Addresses to put on blind copy. Same per-recipient caveat as `cc`.
     */
    bcc?: Array<string>;
    /**
     * Sender address. Must be one the server allows (MAIL_FROM plus MAIL_ALLOWED_FROM); defaults to MAIL_FROM.
     */
    from?: string;
    /**
     * Where replies should go. Defaults to `from`.
     */
    replyTo?: string;
    /**
     * Email subject line
     */
    subject: string;
    /**
     * Array of content blocks (title, text, or button) to render in the email
     */
    content: Array<
      | {
          type: "title";
          /**
           * The title text to display
           */
          content: string;
        }
      | {
          type: "text";
          /**
           * The paragraph text to display
           */
          content: string;
        }
      | {
          type: "button";
          /**
           * The button label text
           */
          text: string;
          /**
           * The URL the button links to
           */
          url: string;
        }
    >;
  };
  export type Strike = {
    /**
     * Strike ID
     */
    id: string;
    /**
     * User ID who received the strike
     */
    userId: string;
    /**
     * Event the strike is connected to
     */
    eventId: string;
    /**
     * Number of strikes
     */
    count: number;
    /**
     * Reason for the strike
     */
    reason: string | null;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Public user info for the struck user
     */
    user: {
      /**
       * User ID
       */
      id: string;
      /**
       * User display name
       */
      name: string;
      /**
       * User profile image URL
       */
      image: string | null;
    };
    /**
     * Event the strike belongs to
     */
    event: {
      /**
       * Event ID
       */
      id: string;
      /**
       * Event title
       */
      title: string;
      /**
       * Event slug
       */
      slug: string;
    };
  };
  export type StrikesByUserList = {
    /**
     * Total number of members with strikes
     */
    totalCount: number;
    /**
     * Total number of pages
     */
    pages: number;
    /**
     * Next page number, or null if last page
     */
    nextPage: number | null;
    members: Array<{
      user: {
        /**
         * User ID
         */
        id: string;
        /**
         * User display name
         */
        name: string;
        /**
         * User profile image URL
         */
        image: string | null;
      };
      /**
       * Sum of the counts of the strikes listed here. A single strike row can be worth several.
       */
      totalStrikes: number;
      strikes: Array<Strike>;
    }>;
  };
  export type StrikeList = {
    /**
     * Total number of strikes
     */
    totalCount: number;
    /**
     * Total number of pages
     */
    pages: number;
    /**
     * Next page number, or null if last page
     */
    nextPage: number | null;
    strikes: Array<Strike>;
  };
  export type MyEventHistory = {
    /**
     * Total number of past registrations
     */
    totalCount: number;
    /**
     * Total number of pages
     */
    pages: number;
    /**
     * Next page number, or null if last page
     */
    nextPage: number | null;
    events: Array<{
      /**
       * Event ID
       */
      eventId: string;
      /**
       * Event title
       */
      title: string;
      /**
       * Event slug
       */
      slug: string;
      /**
       * When the event started
       */
      startTime: string;
      /**
       * Your registration status for the event
       */
      status: "registered" | "attended" | "no_show";
    }>;
  };
  export type MyUpcomingEvents = Array<{
    /**
     * Event ID
     */
    eventId: string;
    /**
     * Event title
     */
    title: string;
    /**
     * Event slug
     */
    slug: string;
    /**
     * When the event starts (ISO 8601)
     */
    startTime: string;
    /**
     * When the event ends (ISO 8601)
     */
    endTime: string;
    /**
     * Slug of the event's category
     */
    categorySlug: string;
    /**
     * Where the event takes place
     */
    location: string | null;
    /**
     * Cover image URL
     */
    image: string | null;
    /**
     * Alt text for the cover image
     */
    imageAlt: string | null;
    /**
     * Name of the organizing group
     */
    organizer: string | null;
    /**
     * Your registration status for the event
     */
    status: "registered" | "waitlisted" | "pending";
    /**
     * Your place in the waitlist, or null if you have a spot
     */
    waitlistPosition: number | null;
  }>;
  export type CreateStrike = {
    /**
     * User ID who receives the strike
     */
    userId: string;
    /**
     * Event the strike is connected to
     */
    eventId: string;
    /**
     * Number of strikes (1-3)
     */
    count?: number;
    /**
     * Reason for the strike
     */
    reason?: string;
  };
  export type DeleteStrikeResponse = { message: string };
  export type UpdateFavoriteResponse = { success: boolean };
  export type UpdateFavoriteEvent = {
    /**
     * Is favorite
     */
    isFavorite: boolean;
  };
  export type FavoriteEvents = Array<{
    /**
     * Event ID
     */
    eventId: string;
    /**
     * Event title
     */
    title: string;
    /**
     * Event slug
     */
    slug: string;
    /**
     * When the event starts (ISO 8601)
     */
    startTime: string;
    /**
     * When the event ends (ISO 8601)
     */
    endTime: string;
    /**
     * When you added this event to your favorites
     */
    createdAt: string;
  }>;
  export type CreateEventResponse = { eventId: string };
  export type CreateEventSchema = {
    /**
     * Short title of the event
     */
    title: string;
    /**
     * Description of the event
     */
    description: string;
    /**
     * Category slug for the event
     */
    categorySlug: string;
    /**
     * Slug of the group organizing the event
     */
    organizerGroupSlug: string;
    /**
     * Location of the event (physical or online)
     */
    location: string;
    /**
     * Latitude of the location, when picked from address search
     */
    locationLat?: number | null;
    /**
     * Longitude of the location, when picked from address search
     */
    locationLng?: number | null;
    /**
     * Main image to display for the event
     */
    imageUrl: string | null;
    /**
     * Alt text for the event image
     */
    imageAlt?: string | null;
    /**
     * When the event starts
     */
    start: string;
    /**
     * When the event ends
     */
    end: string;
    /**
     * Timestamp for when registrations open. If null, open immediately.
     */
    registrationStart: string | null;
    /**
     * When the registration for the event ends. After this time, users cannot sign up. Null for events without sign-up (requiresSigningUp false).
     */
    registrationEnd: string | null;
    /**
     * Deadline timestamp for when users cannot cancel anymore. After this, no-shows may receive strikes.
     */
    cancellationDeadline: string | null;
    /**
     * Maximum number of participants allowed. If null, no capacity limit.
     */
    capacity: number | null;
    /**
     * Is the event closed for new registrations? This overrides registrationStart/End
     */
    isRegistrationClosed: boolean;
    /**
     * Do users need to sign up to attend the event?
     */
    requiresSigningUp: boolean;
    /**
     * Should users be allowed to join a waitlist if the event is full?
     */
    allowWaitlist: boolean;
    /**
     * Priority pools, ORed together. Each pool is one criterion: at most one group and at most one class level, ANDed. At least one of the two must be set. Pools are unordered — being in one is what counts, not which.
     */
    priorityPools: Array<{
      /**
       * Slug of the single group this pool requires, or null
       */
      groupSlug: string | null;
      /**
       * Class level (1-5) this pool requires, or null. Resolved against the member's cohort at registration time, so the pool keeps meaning the same class level as the years roll over.
       */
      classYear: number | null;
    }> | null;
    /**
     * User IDs prioritized individually, independent of the priority pools. A user named here is prioritized on their own — the pools' all-groups-must-match rule does not apply to them.
     */
    priorityUserIds?: Array<string> | null;
    /**
     * Only allow prioritized users to sign up. Can only be true if at least one priority pool has a criterion, or at least one user is in priorityUserIds.
     */
    onlyAllowPrioritized: boolean;
    /**
     * Slug of the NTNU institute this event is reserved for (e.g. 'idi' or 'iik'). Only members of a study group belonging to that institute may sign up. Null — the default — leaves the event open to every institute.
     */
    restrictedToInstituteSlug?: string | null;
    /**
     * Let alumni register too, not only active members. False — the default — leaves the event to active members. Gates registration only; it does not change who can see the event.
     */
    openToAlumni?: boolean;
    /**
     * Can this event give strike penalties to users?
     */
    canCauseStrikes: boolean;
    /**
     * Should the system enforce strike rules for this event?
     */
    enforcesPreviousStrikes: boolean;
    /**
     * Is this a paid event?
     */
    isPaidEvent: boolean;
    /**
     * Price in NOK for attending the event. Can only be set if isPaidEvent is true.
     */
    price: number | null;
    /**
     * User ID of the primary contact person for the event
     */
    contactPersonUserId: string | null;
    /**
     * Should users be able to react to this event with emojis?
     */
    reactionsAllowed: boolean;
    /**
     * Who may see the event. 'public' is visible to everyone including logged-out visitors; 'members' hides it from unauthenticated callers.
     */
    visibility?: "public" | "members";
  };
  export type EventListItem = {
    /**
     * Event ID
     */
    id: string;
    /**
     * Event slug
     */
    slug: string;
    /**
     * Event title
     */
    title: string;
    /**
     * Event location (nullable)
     */
    location?: string | null;
    /**
     * Event start time (ISO 8601)
     */
    startTime: string;
    /**
     * Event end time (ISO 8601)
     */
    endTime: string;
    /**
     * Event organizer (nullable)
     */
    organizer: {
      /**
       * Organizer name
       */
      name: string;
      /**
       * Organizer slug
       */
      slug: string;
      /**
       * Organizer type
       */
      type: string;
    } | null;
    /**
     * Is registration closed
     */
    closed: boolean;
    /**
     * Event image URL (nullable)
     */
    image: string | null;
    /**
     * Alt text for the event image (nullable)
     */
    imageAlt: string | null;
    /**
     * Creator user ID. The creator may update and delete their own event, so an admin listing needs it to tell an event the caller can manage from one they may only look at.
     */
    createdById: string | null;
    /**
     * Event creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Event update time (ISO 8601)
     */
    updatedAt: string;
    /**
     * Event category
     */
    category: {
      /**
       * Category slug
       */
      slug: string;
      /**
       * Category label
       */
      label: string;
    };
    /**
     * Who may see the event ('public' or 'members'-only)
     */
    visibility: "public" | "members";
  };
  export type EventList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of events
     */
    items: Array<EventListItem>;
  };
  export type UpdateEventResponse = {
    eventId: string;
    /**
     * The event slug after the update. Changing the title regenerates it, so clients must use this when linking to the event.
     */
    slug: string;
  };
  export type UpdateEventSchema = Partial<{
    /**
     * Short title of the event
     */
    title: string;
    /**
     * Description of the event
     */
    description: string;
    /**
     * Category slug for the event
     */
    categorySlug: string;
    /**
     * Slug of the group organizing the event
     */
    organizerGroupSlug: string;
    /**
     * Location of the event (physical or online)
     */
    location: string;
    /**
     * Latitude of the location, when picked from address search
     */
    locationLat: number | null;
    /**
     * Longitude of the location, when picked from address search
     */
    locationLng: number | null;
    /**
     * Main image to display for the event
     */
    imageUrl: string | null;
    /**
     * Alt text for the event image
     */
    imageAlt: string | null;
    /**
     * When the event starts
     */
    start: string;
    /**
     * When the event ends
     */
    end: string;
    /**
     * Timestamp for when registrations open. If null, open immediately.
     */
    registrationStart: string | null;
    /**
     * When the registration for the event ends. After this time, users cannot sign up. Null for events without sign-up (requiresSigningUp false).
     */
    registrationEnd: string | null;
    /**
     * Deadline timestamp for when users cannot cancel anymore. After this, no-shows may receive strikes.
     */
    cancellationDeadline: string | null;
    /**
     * Maximum number of participants allowed. If null, no capacity limit.
     */
    capacity: number | null;
    /**
     * Is the event closed for new registrations? This overrides registrationStart/End
     */
    isRegistrationClosed: boolean;
    /**
     * Do users need to sign up to attend the event?
     */
    requiresSigningUp: boolean;
    /**
     * Should users be allowed to join a waitlist if the event is full?
     */
    allowWaitlist: boolean;
    /**
     * Priority pools, ORed together. Each pool is one criterion: at most one group and at most one class level, ANDed. At least one of the two must be set. Pools are unordered — being in one is what counts, not which.
     */
    priorityPools: Array<{
      /**
       * Slug of the single group this pool requires, or null
       */
      groupSlug: string | null;
      /**
       * Class level (1-5) this pool requires, or null. Resolved against the member's cohort at registration time, so the pool keeps meaning the same class level as the years roll over.
       */
      classYear: number | null;
    }> | null;
    /**
     * User IDs prioritized individually, independent of the priority pools. A user named here is prioritized on their own — the pools' all-groups-must-match rule does not apply to them.
     */
    priorityUserIds: Array<string> | null;
    /**
     * Only allow prioritized users to sign up. Can only be true if at least one priority pool has a criterion, or at least one user is in priorityUserIds.
     */
    onlyAllowPrioritized: boolean;
    /**
     * Slug of the NTNU institute this event is reserved for (e.g. 'idi' or 'iik'). Only members of a study group belonging to that institute may sign up. Null — the default — leaves the event open to every institute.
     */
    restrictedToInstituteSlug: string | null;
    /**
     * Let alumni register too, not only active members. False — the default — leaves the event to active members. Gates registration only; it does not change who can see the event.
     */
    openToAlumni: boolean;
    /**
     * Can this event give strike penalties to users?
     */
    canCauseStrikes: boolean;
    /**
     * Should the system enforce strike rules for this event?
     */
    enforcesPreviousStrikes: boolean;
    /**
     * Is this a paid event?
     */
    isPaidEvent: boolean;
    /**
     * Price in NOK for attending the event. Can only be set if isPaidEvent is true.
     */
    price: number | null;
    /**
     * User ID of the primary contact person for the event
     */
    contactPersonUserId: string | null;
    /**
     * Should users be able to react to this event with emojis?
     */
    reactionsAllowed: boolean;
    /**
     * Who may see the event. 'public' is visible to everyone including logged-out visitors; 'members' hides it from unauthenticated callers.
     */
    visibility: "public" | "members";
  }>;
  export type DeleteEventResponse = { message: string };
  export type Event = {
    /**
     * Event ID
     */
    id: string;
    /**
     * Event slug
     */
    slug: string;
    /**
     * Event title
     */
    title: string;
    /**
     * Event description, stored as markdown
     */
    description: string;
    /**
     * Event location (nullable)
     */
    location?: string | null;
    /**
     * Latitude of the location (nullable)
     */
    locationLat?: number | null;
    /**
     * Longitude of the location (nullable)
     */
    locationLng?: number | null;
    /**
     * Event start time (ISO 8601)
     */
    startTime: string;
    /**
     * Event end time (ISO 8601)
     */
    endTime: string;
    /**
     * When registration opens (ISO 8601). Null means it is open immediately.
     */
    registrationStart: string | null;
    /**
     * When registration closes (ISO 8601). Null when the event has no sign-up.
     */
    registrationEnd: string | null;
    /**
     * Last moment a registration can be cancelled without a strike (ISO 8601, nullable)
     */
    cancellationDeadline: string | null;
    /**
     * Event organizer (nullable)
     */
    organizer: {
      /**
       * Organizer name
       */
      name: string;
      /**
       * Organizer slug
       */
      slug: string;
      /**
       * Organizer type
       */
      type: string;
      /**
       * Organizer logo URL
       */
      image: string | null;
    } | null;
    /**
     * Who to ask about the event (nullable). Set with contactPersonUserId.
     */
    contactPerson: {
      /**
       * Contact person user ID
       */
      id: string;
      /**
       * Contact person name
       */
      name: string;
      /**
       * Contact person e-mail. Null for unauthenticated callers, so members' addresses are not exposed to the open internet.
       */
      email: string | null;
    } | null;
    /**
     * Is registration closed
     */
    closed: boolean;
    /**
     * Do users need to sign up to attend the event?
     */
    requiresSigningUp: boolean;
    /**
     * May users join a waitlist when the event is full?
     */
    allowWaitlist: boolean;
    /**
     * Maximum number of participants. Null means no capacity limit.
     */
    capacity: number | null;
    /**
     * Can this event give strikes for late cancellation or no-show?
     */
    canCauseStrikes: boolean;
    /**
     * Number of people signed up (registered, attended or no-show). Public, unlike the roster itself, so the open event page can show how many are going without naming them.
     */
    registeredCount: number;
    /**
     * Number of people on the waitlist. Public for the same reason as registeredCount: how long the queue is tells a member whether signing up is worth it, without naming anyone in it.
     */
    waitlistCount: number;
    /**
     * Event image URL (nullable)
     */
    image: string | null;
    /**
     * Alt text for the event image (nullable)
     */
    imageAlt: string | null;
    /**
     * Creator user ID. The creator may update and delete their own event, so clients need it to decide whether to offer those actions.
     */
    createdById: string | null;
    /**
     * Event creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Event update time (ISO 8601)
     */
    updatedAt: string;
    /**
     * Event category
     */
    category: {
      /**
       * Category slug
       */
      slug: string;
      /**
       * Category label
       */
      label: string;
    };
    reactions: Array<{
      user: {
        /**
         * User ID
         */
        id: string;
        /**
         * User name
         */
        name: string;
        /**
         * Profile picture (nullable)
         */
        image: string | null;
      };
      /**
       * Reaction emoji
       */
      emoji: string;
    }>;
    /**
     * May users react to the event with an emoji?
     */
    reactionsAllowed: boolean;
    /**
     * Is this a paid event
     */
    isPaidEvent: boolean;
    /**
     * Payment info
     */
    payInfo: {
      /**
       * Event price in minor units (øre). Note the create/update endpoints take `price` in whole kroner instead.
       */
      price: number;
      /**
       * How long a member has to pay after securing a spot, in minutes. Read-only and the same for every event — it is a constant in the API, not a per-event setting.
       */
      paymentGracePeriodMinutes: number;
    } | null;
    /**
     * Priority registration pools
     */
    priorityPools: Array<{
      /**
       * Class level (1-5) required by this pool, or null
       */
      classYear: number | null;
      /**
       * Group required by this pool, or null
       */
      group: {
        /**
         * Group name
         */
        name: string;
        /**
         * Group slug
         */
        slug: string;
        /**
         * Group logo URL (nullable)
         */
        logoUrl: string | null;
      } | null;
    }>;
    /**
     * Users prioritized individually, independent of the pools
     */
    priorityUsers: Array<{
      /**
       * User ID
       */
      id: string;
      /**
       * Full name
       */
      name: string | null;
      /**
       * Username
       */
      username: string | null;
      /**
       * Avatar URL (nullable)
       */
      image: string | null;
    }>;
    /**
     * Does the event enforce previous strikes for registration
     */
    enforcesPreviousStrikes: boolean;
    /**
     * Only members covered by a priority pool may register
     */
    onlyAllowPrioritized: boolean;
    /**
     * Whether alumni may register for this event, in addition to active members
     */
    openToAlumni: boolean;
    /**
     * The institute this event is reserved for. Only members of a study group under this institute may register. Null means open to every institute.
     */
    restrictedToInstitute: {
      /**
       * Institute slug
       */
      slug: string;
      /**
       * Short institute name, e.g. 'IDI'
       */
      shortName: string;
      /**
       * Full institute name
       */
      name: string;
    } | null;
    /**
     * Who may see the event ('public' or 'members'-only)
     */
    visibility: "public" | "members";
    /**
     * The current user's registration information. This is null if not registered or if not logged in.
     */
    registration: {
      /**
       * When the user signed up
       */
      createdAt: string;
      /**
       * When the registration was last updated by the system (moving waitlist position etc.)
       */
      updatedAt: string;
      status: "registered" | "waitlisted" | "cancelled" | "attended" | "no_show" | "pending";
      /**
       * The user's position in the waitlist. Is null if not on the waitlist
       */
      waitlistPosition: number | null;
      /**
       * When the user was registered as an attendee by TIHLDE for this event. Is null if not attended.
       */
      attendedAt: string | null;
      /**
       * Whether the user has a completed payment for this event. Always false on free events. A paid registration cannot be cancelled by the user.
       */
      hasPaid: boolean;
      /**
       * Deadline for paying for the reserved spot (ISO 8601). Null when there is nothing to pay — a free event, an already completed payment, or a spot without a payment deadline. The spot is released when the deadline passes.
       */
      paymentExpiresAt: string | null;
    } | null;
  };
  export type EventRegistration = {
    eventId: string;
    userId: string;
    status: "pending";
    createdAt: string;
    /**
     * Photo consent for this event
     */
    allowPhoto: boolean;
  };
  export type CreateEventRegistrationBody = Partial<{
    /**
     * Photo consent for this event. Omit it to use the account-level allowsPhotosByDefault, which is where members manage their consent.
     */
    allowPhoto: boolean;
  }>;
  export type EventRegistrationPayment = {
    id: string;
    status: "pending" | "paid" | "refunded" | "failed";
    amountMinor: number;
    currency: string;
    expiresAt: string | null;
    receivedPaymentAt: string | null;
  };
  export type EventRegisteredUser = {
    /**
     * User id
     */
    id: string;
    /**
     * User name
     */
    name: string;
    /**
     * User image url (if any)
     */
    image: string | null;
    /**
     * True when the member has turned off public event registrations, in which case `id`, `name` and `image` carry no identity. Never true for event admins or for the caller's own registration.
     */
    isAnonymous: boolean;
    /**
     * Photo consent for this event. Only included when the caller has event admin permissions.
     */
    allowPhoto?: boolean;
    /**
     * Registration status (registered/attended/no_show). Only included for event admins.
     */
    status?: string;
    /**
     * When the user was checked in, if at all. Only included for event admins.
     */
    attendedAt?: string | null;
    /**
     * User email. Only included for event admins.
     */
    email?: string;
    /**
     * When the user registered. Only included for event admins.
     */
    registeredAt?: string;
    /**
     * Position on the waitlist, if waitlisted. Only included for event admins.
     */
    waitlistPosition?: number | null;
    /**
     * The user's payment for this event, if any. Only included for event admins.
     */
    payment?: EventRegistrationPayment | null;
    /**
     * Name of the member's study programme, derived from their STUDY group membership. Null when they have none. Only included for event admins.
     */
    studyProgram?: string | null;
    /**
     * The year the member started studying (kull), derived from their study programme or STUDYYEAR group. Null when unknown. Only included for event admins.
     */
    studyStartYear?: number | null;
    /**
     * Class level 1-5, computed from the current programme and its length. A master's first year is 4. Null for alumni and for anyone we cannot place. Only included for event admins.
     */
    classYear?: number | null;
    /**
     * Past the programme's length, on positive evidence. A separate field because `classYear` is null both for the member who has finished and for the one we cannot place at all. Only included for event admins.
     */
    isAlumni?: boolean;
    /**
     * What Feide last said about the member's enrolment on the study programme shown. 'active' and 'inactive' are answers given within the last 120 days — enrolled, and explicitly not enrolled. 'stale' is an answer older than that, and 'unverified' means Feide has never answered: the study came from the Lepton migration, the fadderuka sign-up or an admin correction. Nothing is gated on this — priority pools still match on group membership, and nobody is turned away from an alumni-closed event on it. It tells the organizer how well the study behind a priority is known, and which participants cannot be confirmed as current students. Only included for event admins.
     */
    studyVerification?: "active" | "inactive" | "stale" | "unverified";
  };
  export type EventRegistrationList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of registered users (paginated)
     */
    registeredUsers: Array<EventRegisteredUser>;
  };
  export type Attendance = {
    userId: string;
    eventId: string;
    name: string;
    /**
     * New registration status
     */
    status: string;
    attendedAt: string | null;
  };
  export type SetAttendance = {
    /**
     * True marks the user as attended (checked in); false reverts them to registered.
     */
    attended: boolean;
  };
  export type EventAllergySummaryEntry = {
    /**
     * Display name, as shown to the caterer.
     */
    label: string;
    /**
     * How many participants have this one.
     */
    count: number;
    /**
     * True when this came from free text rather than the curated catalogue.
     */
    custom: boolean;
  };
  export type Allergy = {
    /**
     * Unique identifier for the allergy
     */
    slug: string;
    /**
     * Display name of the allergy
     */
    label: string;
    /**
     * Detailed description of the allergy
     */
    description: string | null;
  };
  export type EventParticipantAllergies = {
    /**
     * User id
     */
    userId: string;
    /**
     * User name
     */
    name: string;
    /**
     * The curated allergies the member has selected.
     */
    allergies: Array<Allergy>;
    /**
     * Free-text allergies the member wrote themselves.
     */
    customAllergies: Array<string>;
  };
  export type EventAllergies = {
    /**
     * Participants counted, i.e. everyone holding a spot. The three tallies below add up to this.
     */
    totalParticipants: number;
    /**
     * Participants who have registered at least one.
     */
    withAllergies: number;
    /**
     * Participants who answered the allergy question and have none.
     */
    confirmedNone: number;
    /**
     * Participants who have never answered. These are the ones an arrangør has to chase — not the same as having no allergies.
     */
    notAnswered: number;
    /**
     * Totals per allergy, most common first. This is what gets handed to the kitchen.
     */
    summary: Array<EventAllergySummaryEntry>;
    /**
     * Only the participants who registered something, so the list stays readable.
     */
    participants: Array<EventParticipantAllergies>;
  };
  export type EventMessage = {
    id: string;
    title: string;
    body: string;
    recipientCount: number;
    sentBy: { id: string; name: string } | null;
    createdAt: string;
  };
  export type EventMessageList = {
    /**
     * How many would get a message sent right now: everyone holding a spot.
     */
    recipientCount: number;
    messages: Array<EventMessage>;
  };
  export type EventMessageContent = {
    /**
     * Short headline. The event title is put in front of it in the email subject, the push and the bell.
     */
    title: string;
    /**
     * Plain text. Line breaks are kept in the email.
     */
    body: string;
  };
  export type CreatePaymentResponse = {
    eventId: string;
    userId: string;
    checkoutUrl: string;
    amount: number;
    currency: string;
  };
  export type CreatePaymentBody = {
    /**
     * URL to redirect user after payment
     */
    returnUrl: string;
    /**
     * User flow type for payment
     */
    userFlow?: "WEB_REDIRECT" | "NATIVE_REDIRECT";
  };
  export type ConfirmPaymentResponse = {
    /**
     * What the payment provider says about the caller's outstanding checkout. 'pending' means the checkout is still open or the provider could not be reached — ask again shortly. 'none' means there is nothing outstanding to confirm.
     */
    status: "paid" | "pending" | "failed" | "none";
  };
  export type EventPaymentAdmin = {
    id: string;
    userId: string;
    user: { id: string; name: string; image: string | null; email: string };
    /**
     * Amount in minor units (øre)
     */
    amountMinor: number;
    currency: string;
    provider: string | null;
    /**
     * Provider reference. Null means the obligation was never started with the provider.
     */
    providerPaymentId: string | null;
    status: "pending" | "paid" | "refunded" | "failed";
    receivedPaymentAt: string | null;
    expiresAt: string | null;
    /**
     * Set when this payment needs an organiser to look at it: 'provider_unreachable' means the deadline fell due while Vipps could not be reached, 'paid_without_spot' means the payment completed for someone who no longer holds a spot.
     */
    flag: ("provider_unreachable" | "paid_without_spot") | null;
    flaggedAt: string | null;
    createdAt: string;
  };
  export type EventPaymentList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of payments for the event (paginated)
     */
    payments: Array<EventPaymentAdmin>;
    /**
     * Totals across every payment for the event
     */
    summary: {
      paidCount: number;
      pendingCount: number;
      refundedCount: number;
      failedCount: number;
      /**
       * Sum of all completed (paid) payments, in minor units
       */
      totalPaidMinor: number;
      /**
       * Payments that need an organiser to look at them
       */
      flaggedCount: number;
    };
  };
  export type RefundEventPayment = {
    id: string;
    status: "pending" | "paid" | "refunded" | "failed";
    /**
     * The amount that was refunded, in minor units
     */
    refundedAmountMinor: number;
    currency: string;
  };
  export type CreateEventFormResponse = {
    id?: string;
    title?: string;
    description?: string | null;
    type: "survey" | "evaluation";
    resource_type: string;
    created_at?: string;
    updated_at?: string;
    fields?: Array<{
      id: string;
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required: boolean;
      order: number;
      options: Array<{ id: string; title: string; order: number }>;
    }>;
  };
  export type CreateEventForm = {
    title: string;
    description?: string;
    template?: boolean;
    fields?: Array<{
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required?: boolean;
      order?: number;
      options?: Array<{ title: string; order?: number }>;
    }>;
    event: string;
    type: "survey" | "evaluation";
  };
  export type EventFormList = Array<{
    id: string;
    title: string;
    description: string | null;
    type: "survey" | "evaluation";
    resource_type: string;
    viewer_has_answered: boolean;
    created_at: string;
    updated_at: string;
  }>;
  export type EventFormDetail = {
    id: string;
    title: string;
    description: string | null;
    type: "survey" | "evaluation";
    resource_type: string;
    viewer_has_answered: boolean;
    website_url: string;
    created_at: string;
    updated_at: string;
    fields: Array<{
      id: string;
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required: boolean;
      order: number;
      options: Array<{ id: string; title: string; order: number }>;
    }>;
  };
  export type EventReaction = {
    /**
     * User ID
     */
    userId: string;
    /**
     * Event ID
     */
    eventId: string;
    /**
     * Emoji reaction
     */
    emoji: string;
    /**
     * Reaction creation time (ISO 8601)
     */
    createdAt: string;
  };
  export type CreateEventReaction = {
    /**
     * Emoji reaction (e.g., 👍, ❤️, 😂)
     */
    emoji: string;
  };
  export type DeleteEventReactionResponse = { message: string };
  export type FeedbackAuthor = { id: string; name: string; image: string | null };
  export type FeedbackItem = {
    /**
     * Feedback ID
     */
    id: string;
    type: "idea" | "bug";
    status: "open" | "in_progress" | "closed" | "rejected";
    title: string;
    description: string;
    isAnonymous: boolean;
    /**
     * Whether the requesting user filed this.
     */
    isAuthor: boolean;
    /**
     * Who filed it. Always null when the feedback is anonymous.
     */
    author: FeedbackAuthor | null;
    upvotes: number;
    downvotes: number;
    /**
     * The requesting user's own vote, if any
     */
    myVote: ("up" | "down") | null;
    rejectionReason: string | null;
    /**
     * Whether the requesting user may edit it: they filed it, it is still open, and nobody else has voted or commented.
     */
    isEditable: boolean;
    commentCount: number;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
  };
  export type FeedbackList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of feedback
     */
    items: Array<FeedbackItem>;
  };
  export type CreateFeedback = {
    /**
     * Idea or bug report
     */
    type: "idea" | "bug";
    /**
     * Short title
     */
    title: string;
    /**
     * What the idea or the bug is
     */
    description: string;
    /**
     * Hide the author's name from everyone else. Defaults to anonymous.
     */
    isAnonymous?: boolean;
  };
  export type UpdateFeedback = Partial<{
    title: string;
    description: string;
    /**
     * Author only, and only while the feedback is editable
     */
    isAnonymous: boolean;
    status: "open" | "in_progress" | "closed" | "rejected";
    /**
     * Why Index rejected it. Only allowed with status 'rejected'; cleared when the status changes.
     */
    rejectionReason: string | null;
  }>;
  export type FeedbackMessageResponse = { message: string };
  export type FeedbackVoteCounts = { upvotes: number; downvotes: number; myVote: ("up" | "down") | null };
  export type VoteFeedback = {
    /**
     * Thumbs up or thumbs down
     */
    value: "up" | "down";
  };
  export type FeedbackComment = {
    id: string;
    body: string;
    /**
     * Written by the person who filed the feedback
     */
    isFeedbackAuthor: boolean;
    isMine: boolean;
    /**
     * Null when the feedback author replies on anonymous feedback, or the user is deleted.
     */
    author: FeedbackAuthor | null;
    createdAt: string;
  };
  export type FeedbackCommentList = Array<FeedbackComment>;
  export type CreateFeedbackComment = { body: string };
  export type FormResponse = {
    id: string;
    title: string;
    description: string | null;
    template: boolean;
    created_at: string;
    updated_at: string;
  };
  export type CreateForm = {
    title: string;
    description?: string;
    template?: boolean;
    fields?: Array<{
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required?: boolean;
      order?: number;
      options?: Array<{ title: string; order?: number }>;
    }>;
  };
  export type FormList = Array<{
    id: string;
    title: string;
    description: string | null;
    template: boolean;
    resource_type: string;
    viewer_has_answered: boolean;
    created_at: string;
    updated_at: string;
  }>;
  export type FormDetail = {
    id: string;
    title: string;
    description: string | null;
    template: boolean;
    resource_type: "Form" | "EventForm" | "GroupForm";
    viewer_has_answered: boolean;
    website_url: string;
    created_at: string;
    updated_at: string;
    fields: Array<{
      id: string;
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required: boolean;
      order: number;
      options: Array<{ id: string; title: string; order: number }>;
    }>;
    type: ("survey" | "evaluation") | null;
    event: { id: string; title: string; slug: string | null; start_date: string; location: string | null } | null;
    group: { slug: string; name: string } | null;
    can_submit_multiple: boolean | null;
    is_open_for_submissions: boolean | null;
    opens_at: string | null;
    closes_at: string | null;
    only_for_group_members: boolean | null;
  };
  export type UpdateFormResponse = Partial<{
    id: string;
    title: string;
    description: string | null;
    template: boolean;
    created_at: string;
    updated_at: string;
    fields: Array<{
      id: string;
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required: boolean;
      order: number;
      options: Array<{ id: string; title: string; order: number }>;
    }>;
    email_receiver_on_submit: string | null;
    can_submit_multiple: boolean | null;
    is_open_for_submissions: boolean | null;
    opens_at: string | null;
    closes_at: string | null;
    only_for_group_members: boolean | null;
  }>;
  export type UpdateForm = Partial<{
    title: string;
    description: string;
    template: boolean;
    fields: Array<{
      id?: string;
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required?: boolean;
      order?: number;
      options?: Array<{ id?: string; title: string; order?: number }>;
    }>;
    email_receiver_on_submit: string | null;
    can_submit_multiple: boolean;
    is_open_for_submissions: boolean;
    only_for_group_members: boolean;
    /**
     * When the form opens for submissions; until then it stays closed. Setting it turns is_open_for_submissions on, and turning that off clears this.
     */
    opens_at: string | null;
    /**
     * When the form closes for submissions; after it the form stops taking answers. Setting it turns is_open_for_submissions on, and turning that off clears this.
     */
    closes_at: string | null;
  }>;
  export type DeleteFormResponse = { detail: string };
  export type FormStatistics = {
    id: string;
    title: string;
    resource_type: string;
    statistics: Array<{
      id: string;
      title: string;
      type: "multiple_select" | "single_select";
      required: boolean;
      options: Array<{ id: string; title: string; answer_amount: number; answer_percentage: number }>;
    }>;
  };
  export type CreateSubmissionResponse = { id: string; message: string };
  export type CreateSubmission = {
    answers: Array<{ field: { id: string }; answer_text?: string; selected_options?: Array<{ id: string }> }>;
  };
  export type SubmissionList = Array<{
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      study_program: string | null;
      class_year: number | null;
      is_alumni: boolean;
    };
    created_at: string;
    updated_at: string;
    answers: Array<{
      id: string;
      field_id: string | null;
      answer_text: string | null;
      selected_options: Array<{ id: string; title: string }>;
    }>;
  }>;
  export type DeleteSubmissionResponse = { detail: string };
  export type SubmissionDetail = {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      study_program: string | null;
      class_year: number | null;
      is_alumni: boolean;
    };
    created_at: string;
    updated_at: string;
    answers: Array<{
      id: string;
      field_id: string | null;
      answer_text: string | null;
      selected_options: Array<{ id: string; title: string }>;
    }>;
  };
  export type DeleteSubmissionWithReason = { reason: string };
  export type Gallery = {
    /**
     * Album ID
     */
    id: string;
    /**
     * Public URL slug
     */
    slug: string;
    /**
     * Album title
     */
    title: string;
    description: string | null;
    /**
     * Cover image URL
     */
    imageUrl: string | null;
    imageAlt: string | null;
    /**
     * Number of pictures in the album
     */
    pictureCount: number;
    /**
     * Arrangement the album belongs to, if any
     */
    event: {
      id: string;
      title: string;
      slug: string;
      /**
       * Start time (ISO 8601)
       */
      start: string;
    } | null;
    createdById: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
  };
  export type CreateGallery = {
    /**
     * Album title, e.g. 'Julebord 2025'
     */
    title: string;
    /**
     * Optional description shown on the album
     */
    description?: string;
    /**
     * Cover image shown in the album list
     */
    imageUrl?: string;
    /**
     * Alt text for the cover image
     */
    imageAlt?: string;
    /**
     * Arrangement the pictures are from, if any
     */
    eventId?: string;
  };
  export type GalleryList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of albums
     */
    items: Array<Gallery>;
  };
  export type GalleryPicture = {
    /**
     * Picture ID
     */
    id: string;
    /**
     * Album the picture belongs to
     */
    albumId: string;
    /**
     * Image URL
     */
    imageUrl: string;
    imageAlt: string | null;
    title: string | null;
    description: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
  };
  export type GalleryPictureList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of pictures
     */
    items: Array<GalleryPicture>;
  };
  export type CreateGalleryPicturesResponse = {
    /**
     * Number of pictures added
     */
    created: number;
    items: Array<GalleryPicture>;
  };
  export type CreateGalleryPictures = {
    /**
     * Pictures to add to the album
     */
    pictures: Array<{
      /**
       * URL of the uploaded image
       */
      imageUrl: string;
      imageAlt?: string;
      title?: string;
      description?: string;
    }>;
  };
  export type UpdateGalleryPicture = Partial<{
    imageAlt: string | null;
    title: string | null;
    description: string | null;
  }>;
  export type DeleteGalleryPictureResponse = { message: string };
  export type UpdateGallery = Partial<{
    title: string;
    description: string | null;
    imageUrl: string | null;
    imageAlt: string | null;
    eventId: string | null;
  }>;
  export type DeleteGalleryResponse = { message: string };
  export type NotificationDeviceResponse = {
    /**
     * Whether the device registry was updated
     */
    success: boolean;
  };
  export type RegisterNotificationDevice = {
    /**
     * Expo push token for the device, e.g. "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
     */
    token: string;
    /**
     * Platform the device runs
     */
    platform: "ios" | "android";
  };
  export type UnregisterNotificationDevice = {
    /**
     * Expo push token to stop sending to
     */
    token: string;
  };
  export type Notification = {
    /**
     * Notification ID
     */
    id: string;
    /**
     * User ID
     */
    userId: string;
    /**
     * Notification title
     */
    title: string;
    /**
     * Notification description
     */
    description: string;
    /**
     * Optional link URL (nullable)
     */
    link: string | null;
    /**
     * Whether notification is read
     */
    isRead: boolean;
    /**
     * Notification creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Notification update time (ISO 8601)
     */
    updatedAt: string;
  };
  export type NotificationList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of notifications
     */
    items: Array<Notification>;
  };
  export type DeleteNotificationResponse = {
    /**
     * Whether deletion was successful
     */
    success: boolean;
  };
  export type MarkAllNotificationsReadResponse = {
    /**
     * Number of notifications marked as read
     */
    updatedCount: number;
  };
  export type MarkReadResponse = {
    /**
     * Notification ID
     */
    id: string;
    /**
     * Updated read status
     */
    isRead: boolean;
    /**
     * Notification update time (ISO 8601)
     */
    updatedAt: string;
  };
  export type MarkNotificationRead = {
    /**
     * Whether notification should be marked as read
     */
    isRead: boolean;
  };
  export type GroupWithMemberCount = {
    /**
     * Group slug
     */
    slug: string;
    /**
     * Gruppebilde URL, shown on the group's about page
     */
    imageUrl: string | null;
    /**
     * Group logo URL, shown in avatars and cards
     */
    logoUrl: string | null;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    description: string | null;
    /**
     * Group contact email
     */
    contactEmail: string | null;
    /**
     * Group type
     */
    type: string;
    /**
     * Sub-category below type. GRUPPE or IDRETTSGRUPPE for interest groups, null otherwise.
     */
    subtype: string | null;
    /**
     * Group fines info
     */
    finesInfo: string;
    /**
     * Group fines activated
     */
    finesActivated: boolean;
    /**
     * Group fines admin ID
     */
    finesAdminId: string | null;
    /**
     * Whether contract signing is required
     */
    contractSigningRequired: boolean;
    /**
     * When the group was archived, or null while it is active. An archived group is visible to its members only, cannot be changed, and grants no permissions.
     */
    archivedAt: string | null;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
    /**
     * Number of members in the group
     */
    memberCount: number;
  };
  export type GroupList = Array<GroupWithMemberCount>;
  export type MyGroup = {
    /**
     * Group slug
     */
    slug: string;
    /**
     * Gruppebilde URL, shown on the group's about page
     */
    imageUrl: string | null;
    /**
     * Group logo URL, shown in avatars and cards
     */
    logoUrl: string | null;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    description: string | null;
    /**
     * Group contact email
     */
    contactEmail: string | null;
    /**
     * Group type
     */
    type: string;
    /**
     * Sub-category below type. GRUPPE or IDRETTSGRUPPE for interest groups, null otherwise.
     */
    subtype: string | null;
    /**
     * Group fines info
     */
    finesInfo: string;
    /**
     * Group fines activated
     */
    finesActivated: boolean;
    /**
     * Group fines admin ID
     */
    finesAdminId: string | null;
    /**
     * Whether contract signing is required
     */
    contractSigningRequired: boolean;
    /**
     * When the group was archived, or null while it is active. An archived group is visible to its members only, cannot be changed, and grants no permissions.
     */
    archivedAt: string | null;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
    membership: { role: "member" | "leader"; joinedAt: string; updatedAt: string };
  };
  export type MyGroupList = Array<MyGroup>;
  export type UpdateGroupResponse = { message: string };
  export type Group = {
    /**
     * Group slug
     */
    slug: string;
    /**
     * Gruppebilde URL, shown on the group's about page
     */
    imageUrl: string | null;
    /**
     * Group logo URL, shown in avatars and cards
     */
    logoUrl: string | null;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    description: string | null;
    /**
     * Group contact email
     */
    contactEmail: string | null;
    /**
     * Group type
     */
    type: string;
    /**
     * Sub-category below type. GRUPPE or IDRETTSGRUPPE for interest groups, null otherwise.
     */
    subtype: string | null;
    /**
     * Group fines info
     */
    finesInfo: string;
    /**
     * Group fines activated
     */
    finesActivated: boolean;
    /**
     * Group fines admin ID
     */
    finesAdminId: string | null;
    /**
     * Whether contract signing is required
     */
    contractSigningRequired: boolean;
    /**
     * When the group was archived, or null while it is active. An archived group is visible to its members only, cannot be changed, and grants no permissions.
     */
    archivedAt: string | null;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
  };
  export type CreateGroup = {
    /**
     * Unique group slug identifier
     */
    slug: string;
    /**
     * Gruppebilde URL, shown on the group's about page
     */
    imageUrl?: string;
    /**
     * Group logo URL, shown in avatars and cards
     */
    logoUrl?: string;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    description?: string;
    /**
     * Group contact email
     */
    contactEmail?: string;
    /**
     * Group type (e.g., committee, study, interestgroup)
     */
    type: string;
    /**
     * Sub-category below type. Only used for interest groups today: GRUPPE or IDRETTSGRUPPE, which the org chart renders as separate sections.
     */
    subtype?: string;
    /**
     * Information about group fines policy
     */
    finesInfo?: string;
    /**
     * Whether fines are activated for this group
     */
    finesActivated?: boolean;
    /**
     * User ID of the fines administrator
     */
    finesAdminId?: string;
  };
  export type UpdateGroup = Partial<{
    /**
     * Gruppebilde URL, shown on the group's about page
     */
    imageUrl: string;
    /**
     * Group logo URL, shown in avatars and cards
     */
    logoUrl: string;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    description: string | null;
    /**
     * Group contact email
     */
    contactEmail: string | null;
    /**
     * Group type
     */
    type: string;
    /**
     * Sub-category below type (GRUPPE or IDRETTSGRUPPE for interest groups). Null clears it.
     */
    subtype: string | null;
    /**
     * Information about group fines policy
     */
    finesInfo: string;
    /**
     * Whether fines are activated for this group
     */
    finesActivated: boolean;
    /**
     * User ID of the fines administrator
     */
    finesAdminId: string | null;
    /**
     * Whether contract signing is required for group members
     */
    contractSigningRequired: boolean;
  }>;
  export type GroupDetail = {
    /**
     * Group slug
     */
    slug: string;
    /**
     * Gruppebilde URL, shown on the group's about page
     */
    imageUrl: string | null;
    /**
     * Group logo URL, shown in avatars and cards
     */
    logoUrl: string | null;
    /**
     * Group name
     */
    name: string;
    /**
     * Group description
     */
    description: string | null;
    /**
     * Group contact email
     */
    contactEmail: string | null;
    /**
     * Group type
     */
    type: string;
    /**
     * Sub-category below type. GRUPPE or IDRETTSGRUPPE for interest groups, null otherwise.
     */
    subtype: string | null;
    /**
     * Group fines info
     */
    finesInfo: string;
    /**
     * Group fines activated
     */
    finesActivated: boolean;
    /**
     * Group fines admin ID
     */
    finesAdminId: string | null;
    /**
     * Whether contract signing is required
     */
    contractSigningRequired: boolean;
    /**
     * When the group was archived, or null while it is active. An archived group is visible to its members only, cannot be changed, and grants no permissions.
     */
    archivedAt: string | null;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
    /**
     * What this group calls its leader, e.g. «President» or «Innovasjonsminister». Reconciled with the linked Hovedstyret verv, so both pages name the leader the same. Null means the plain «Leder».
     */
    leaderTitle: string | null;
    /**
     * Whether this group may be archived at all. False for Hovedstyret and for groups whose roster follows Feide.
     */
    archivable: boolean;
    /**
     * Whether the authenticated caller may see and give fines in this group. False when fines are off, when signed out, or when the caller is a study-group member who is no longer an enrolled student.
     */
    viewerCanUseFines: boolean;
    /**
     * Whether the caller may read the fines they are party to here without taking part in the group's fine system: true for someone who has left the group but was once a member. Never true together with 'viewerCanUseFines'.
     */
    viewerCanSeeOwnFines: boolean;
  };
  export type Fine = {
    /**
     * Fine ID
     */
    id: string;
    /**
     * User ID who received the fine
     */
    userId: string;
    /**
     * Group slug that issued the fine
     */
    groupSlug: string;
    /**
     * Reason for the fine
     */
    reason: string;
    /**
     * Fine amount in NOK
     */
    amount: number;
    /**
     * User's defense text
     */
    defense: string | null;
    /**
     * Evidence image URL. Private — the asset route refuses it; read the picture through GET /api/groups/{groupSlug}/fines/{fineId}/image. Use this field only to tell whether a fine has a picture.
     */
    image: string | null;
    /**
     * Fine status (pending, approved, paid, rejected)
     */
    status: string;
    /**
     * User who created the fine
     */
    createdByUserId: string | null;
    /**
     * User who approved the fine
     */
    approvedByUserId: string | null;
    /**
     * Approval timestamp
     */
    approvedAt: string | null;
    /**
     * Payment timestamp
     */
    paidAt: string | null;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
    /**
     * Public user info for the fined user
     */
    user: {
      /**
       * User ID
       */
      id: string;
      /**
       * User display name
       */
      name: string;
      /**
       * User profile image URL
       */
      image: string | null;
    };
    /**
     * Public user info for the fine creator
     */
    createdByUser: {
      /**
       * User ID
       */
      id: string;
      /**
       * User display name
       */
      name: string;
      /**
       * User profile image URL
       */
      image: string | null;
    } | null;
    /**
     * ID of the paragraph the fine was given under
     */
    lawId: string | null;
    /**
     * The paragraph in the group's lovverk. Null for fines migrated from Lepton and for fines given without one.
     */
    law: {
      /**
       * Law ID
       */
      id: string;
      /**
       * Paragraph number, e.g. 3.10
       */
      paragraph: string;
      /**
       * Paragraph title
       */
      title: string;
    } | null;
  };
  export type FineList = {
    /**
     * Total number of fines
     */
    totalCount: number;
    /**
     * Total number of pages
     */
    pages: number;
    /**
     * Next page number, or null if last page
     */
    nextPage: number | null;
    fines: Array<Fine>;
  };
  export type CreateFine = {
    /**
     * User ID who receives the fine
     */
    userId: string;
    /**
     * Group slug that issues the fine
     */
    groupSlug: string;
    /**
     * Reason for the fine
     */
    reason: string;
    /**
     * Number of fines given (may be negative)
     */
    amount: number;
    /**
     * User's defense text
     */
    defense?: string;
    /**
     * Evidence image URL
     */
    image?: string;
    /**
     * Paragraph in the group's lovverk the fine is given under. Optional: a group whose lovverk is empty can still hand out fines.
     */
    lawId?: string;
  };
  export type FineStatistics = {
    /**
     * Sum of amounts for fines awaiting approval
     */
    notApproved: number;
    /**
     * Sum of amounts for approved, unpaid fines
     */
    approvedNotPaid: number;
    /**
     * Sum of amounts for paid fines
     */
    paid: number;
  };
  export type FineUserList = {
    /**
     * Total number of members
     */
    totalCount: number;
    /**
     * Total number of pages
     */
    pages: number;
    /**
     * Next page number, or null if last page
     */
    nextPage: number | null;
    users: Array<{
      /**
       * User ID
       */
      id: string;
      /**
       * User display name
       */
      name: string;
      /**
       * User profile image URL
       */
      image: string | null;
      /**
       * Sum of the member's fine amounts in this group, 0 when they have none
       */
      finesAmount: number;
      /**
       * Number of fines the member has
       */
      finesCount: number;
    }>;
  };
  export type BatchUpdateFinesResponse = {
    message: string;
    /**
     * Number of fines that were updated
     */
    updated: number;
  };
  export type BatchUpdateFines = {
    /**
     * The fines to update
     */
    fineIds: Array<string>;
    /**
     * Fine status
     */
    status: "pending" | "approved" | "paid" | "rejected";
  };
  export type BatchUpdateUserFines = {
    /**
     * Fine status
     */
    status: "pending" | "approved" | "paid" | "rejected";
  };
  export type UpdateFineResponse = { message: string };
  export type UpdateFine = Partial<{
    /**
     * User's defense text
     */
    defense: string;
    /**
     * Evidence image URL. Null removes the picture. Only the fines admin or the group's leader may change it, and the picture it replaces is deleted.
     */
    image: string | null;
    /**
     * Fine status
     */
    status: "pending" | "approved" | "paid" | "rejected";
    /**
     * Reason for the fine. Only the fines admin or the group's leader may change it.
     */
    reason: string;
    /**
     * Number of fines given (may be negative). Only the fines admin or the group's leader may change it.
     */
    amount: number;
    /**
     * Paragraph in the group's lovverk the fine is given under. Null removes the link. Only the fines admin or the group's leader may change it.
     */
    lawId: string | null;
  }>;
  export type Law = {
    /**
     * Law ID
     */
    id: string;
    /**
     * Group the law belongs to
     */
    groupSlug: string;
    /**
     * Paragraph number as a decimal string
     */
    paragraph: string;
    /**
     * Law title
     */
    title: string;
    /**
     * Longer description of the law
     */
    description: string;
    /**
     * Default number of fine units
     */
    amount: number;
    /**
     * Creation timestamp
     */
    createdAt: string;
    /**
     * Last update timestamp
     */
    updatedAt: string;
  };
  export type LawList = Array<Law>;
  export type CreateLaw = {
    /**
     * Paragraph number, e.g. 1 or 3.12
     */
    paragraph: number;
    /**
     * Law title
     */
    title: string;
    /**
     * Longer description of the law
     */
    description?: string;
    /**
     * Default number of fine units
     */
    amount?: number;
  };
  export type UpdateLaw = Partial<{
    /**
     * Paragraph number, e.g. 1 or 3.12
     */
    paragraph: number;
    /**
     * Law title
     */
    title: string;
    /**
     * Longer description of the law
     */
    description: string;
    /**
     * Default number of fine units
     */
    amount: number;
  }>;
  export type GroupFormerMember = {
    /**
     * Membership history entry ID
     */
    id: string;
    /**
     * User ID
     */
    userId: string;
    /**
     * Group slug
     */
    groupSlug: string;
    /**
     * Role held when the membership ended
     */
    role: string;
    /**
     * When the membership started
     */
    startedAt: string;
    /**
     * When the membership ended
     */
    endedAt: string;
    /**
     * Public user info for the former member
     */
    user: {
      /**
       * User ID
       */
      id: string;
      /**
       * User display name
       */
      name: string;
      /**
       * Username used in profile URLs
       */
      username: string | null;
      /**
       * User profile image URL
       */
      image: string | null;
    };
  };
  export type GroupFormerMemberList = Array<GroupFormerMember>;
  export type GroupMember = {
    /**
     * User ID
     */
    userId: string;
    /**
     * Group slug
     */
    groupSlug: string;
    /**
     * Membership role
     */
    role: string;
    /**
     * Membership creation timestamp
     */
    createdAt: string;
    /**
     * Membership update timestamp
     */
    updatedAt: string;
    /**
     * Public user info for the member
     */
    user: {
      /**
       * User ID
       */
      id: string;
      /**
       * User display name
       */
      name: string;
      /**
       * Username used in profile URLs
       */
      username: string | null;
      /**
       * User profile image URL
       */
      image: string | null;
      /**
       * Name of the member's study programme, derived from their STUDY group membership. Null when the member has none (alumni, honorary members).
       */
      studyProgram: string | null;
      /**
       * The year the member started studying (kull), derived from their STUDYYEAR group membership. Null when unknown.
       */
      studyStartYear: number | null;
      /**
       * Class level 1-5, computed from the current programme and its length. A master's first year is 4. Null for alumni and for anyone we cannot place.
       */
      classYear: number | null;
      /**
       * Past the programme's length, on positive evidence. A separate field because `classYear` is null both for the member who has finished and for the one we cannot place at all.
       */
      isAlumni: boolean;
    };
  };
  export type GroupMemberList = Array<GroupMember>;
  export type GroupMembership = {
    /**
     * User ID
     */
    userId: string;
    /**
     * Group slug
     */
    groupSlug: string;
    /**
     * Membership role
     */
    role: "member" | "leader";
    /**
     * Membership creation timestamp
     */
    createdAt: string;
    /**
     * Membership update timestamp
     */
    updatedAt: string;
  };
  export type AddGroupMember = {
    /**
     * User ID to add as member
     */
    userId: string;
    /**
     * Membership role
     */
    role?: "member" | "leader";
  };
  export type UpdateMemberRoleResponse = { message: string };
  export type UpdateGroupMemberRole = {
    /**
     * Membership role
     */
    role: "member" | "leader";
  };
  export type GroupPositionHolder = {
    /**
     * Holder's user ID
     */
    userId: string;
    /**
     * Holder's name
     */
    name: string | null;
    /**
     * Holder's profile image
     */
    image: string | null;
  };
  export type GroupPosition = {
    /**
     * Position ID
     */
    id: string;
    /**
     * Group slug
     */
    groupSlug: string;
    /**
     * Position name
     */
    name: string;
    description: string | null;
    permissions: Array<string>;
    scope: "group" | "global";
    globalPermissions: Array<string>;
    /**
     * If set, this position is held automatically by the leader of the given subgroup and cannot be assigned manually.
     */
    linkedGroupSlug: string | null;
    /**
     * Everyone holding this position. A verv may be shared by several people (issue #646); empty when nobody holds it.
     */
    holders: Array<GroupPositionHolder>;
    createdAt: string;
    updatedAt: string;
  };
  export type GroupPositionList = Array<GroupPosition>;
  export type CreateGroupPosition = {
    /**
     * Position name, e.g. 'Økonomiansvarlig'
     */
    name: string;
    /**
     * Optional description of the position
     */
    description?: string;
    /**
     * Permissions granted to holders of this position. Must be valid permission names from the registry.
     */
    permissions: Array<string>;
    /**
     * Whether permissions apply only within this group, or globally (global requires roles:create)
     */
    scope?: "group" | "global";
    /**
     * Held across all of TIHLDE by holders of this group-scoped verv, e.g. job postings for NoKs Annonsør. Requires holding each of them globally yourself. Must be empty on a global verv.
     */
    globalPermissions?: Array<string>;
  };
  export type UpdateGroupPosition = Partial<{
    name: string;
    description: string | null;
    /**
     * Permissions granted to holders of this position. Must be valid permission names from the registry.
     */
    permissions: Array<string>;
    scope: "group" | "global";
    /**
     * Held across all of TIHLDE by holders of this group-scoped verv, e.g. job postings for NoKs Annonsør. Requires holding each of them globally yourself. Must be empty on a global verv.
     */
    globalPermissions: Array<string>;
  }>;
  export type GroupPositionMessage = { message: string };
  export type AssignGroupPosition = {
    /**
     * User to assign the position to
     */
    userId: string;
  };
  export type GroupLeaderPermissions = {
    /**
     * Permissions held by whoever currently leads this group, scoped to this group.
     */
    permissions: Array<string>;
    /**
     * Permissions held by whoever currently leads this group across all of TIHLDE, unscoped.
     */
    globalPermissions: Array<string>;
    /**
     * What this group calls its leader, e.g. 'President'. Null when the group has no custom title and the leader is simply «Leder».
     */
    title: string | null;
  };
  export type UpdateGroupLeaderPermissions = {
    /**
     * Permissions the group's leader holds, scoped to this group. Replaces the existing list. Only permissions that can apply to a single group are accepted.
     */
    permissions: Array<string>;
    /**
     * Permissions the group's leader holds across all of TIHLDE. Replaces the existing list. Requires holding each permission globally yourself. Omit to leave unchanged.
     */
    globalPermissions?: Array<string>;
    /**
     * What this group calls its leader, e.g. 'President'. Null clears it back to 'Leder'. Omit to leave unchanged.
     */
    title?: string | null;
  };
  export type GroupMemberPermissions = {
    /**
     * Permissions held by every member of this group, scoped to this group.
     */
    permissions: Array<string>;
    /**
     * Permissions held by every member of this group across all of TIHLDE, unscoped.
     */
    globalPermissions: Array<string>;
  };
  export type UpdateGroupMemberPermissions = {
    /**
     * Permissions every member of this group holds, scoped to this group. Replaces the existing list. Only permissions that can apply to a single group are accepted.
     */
    permissions: Array<string>;
    /**
     * Permissions every member of this group holds across all of TIHLDE. Replaces the existing list. Requires holding each permission globally yourself.
     */
    globalPermissions: Array<string>;
  };
  export type CreateGroupFormResponse = {
    id?: string;
    title?: string;
    description?: string | null;
    group: string;
    email_receiver_on_submit?: string | null;
    can_submit_multiple?: boolean;
    is_open_for_submissions?: boolean;
    opens_at?: string | null;
    closes_at?: string | null;
    only_for_group_members?: boolean;
    resource_type: string;
    created_at?: string;
    updated_at?: string;
    fields?: Array<{
      id: string;
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required: boolean;
      order: number;
      options: Array<{ id: string; title: string; order: number }>;
    }>;
  };
  export type CreateGroupForm = {
    title: string;
    description?: string;
    template?: boolean;
    fields?: Array<{
      title: string;
      type: "text_answer" | "multiple_select" | "single_select";
      required?: boolean;
      order?: number;
      options?: Array<{ title: string; order?: number }>;
    }>;
    group: string;
    email_receiver_on_submit?: string;
    can_submit_multiple?: boolean;
    is_open_for_submissions?: boolean;
    only_for_group_members?: boolean;
    /**
     * When the form opens for submissions; until then it stays closed. Setting it turns is_open_for_submissions on, and turning that off clears this.
     */
    opens_at?: string | null;
    /**
     * When the form closes for submissions; after it the form stops taking answers. Setting it turns is_open_for_submissions on, and turning that off clears this.
     */
    closes_at?: string | null;
  };
  export type GroupFormList = Array<{
    id: string;
    title: string;
    description: string | null;
    group: string;
    email_receiver_on_submit: string | null;
    can_submit_multiple: boolean;
    is_open_for_submissions: boolean;
    opens_at: string | null;
    closes_at: string | null;
    is_open_now: boolean;
    only_for_group_members: boolean;
    resource_type: string;
    viewer_has_answered: boolean;
    created_at: string;
    updated_at: string;
  }>;
  export type Institute = {
    /**
     * Institute slug, e.g. 'idi'
     */
    slug: string;
    /**
     * Short institute name, e.g. 'IDI'
     */
    shortName: string;
    /**
     * Full institute name
     */
    name: string;
  };
  export type InstituteList = Array<Institute>;
  export type SignaturePlacementOutput = { page: number; xPct: number; yPct: number; wPct: number; hPct: number };
  export type ActiveContract = {
    id: string;
    title: string;
    version: string;
    fileKey: string;
    isActive: boolean;
    signaturePlacement: SignaturePlacementOutput | null;
    namePlacement: SignaturePlacementOutput | null;
    createdAt: string;
    updatedAt: string;
    /**
     * Direct URL to stream the PDF
     */
    downloadUrl: string;
  };
  export type SignatureStatus = {
    hasSigned: boolean;
    signedAt: string | null;
    signedName: string | null;
    /**
     * Whether the user is in at least one group that requires contract signing
     */
    requiresSigning: boolean;
  };
  export type SignContractResponse = { message: string; signedAt: string };
  export type SignContract = {
    /**
     * Full name the member signed with
     */
    signedName: string;
    /**
     * Signature as a PNG data URL, produced by the signature pad
     */
    signatureDataUrl: string;
  };
  export type Contract = {
    id: string;
    title: string;
    version: string;
    fileKey: string;
    isActive: boolean;
    signaturePlacement: SignaturePlacementOutput | null;
    namePlacement: SignaturePlacementOutput | null;
    createdAt: string;
    updatedAt: string;
  };
  export type ContractList = Array<Contract>;
  export type SignaturePlacement = { page: number; xPct: number; yPct: number; wPct: number; hPct: number };
  export type CreateContract = {
    /**
     * Contract title
     */
    title: string;
    /**
     * Version identifier e.g. '2026-01'
     */
    version: string;
    /**
     * Asset key from POST /api/assets
     */
    fileKey: string;
    /**
     * Where the member's signature is stamped on the PDF
     */
    signaturePlacement?: SignaturePlacement | null;
    /**
     * Where the signer's name and date are written
     */
    namePlacement?: SignaturePlacement | null;
  };
  export type ActivateContractResponse = { message: string };
  export type GroupSignatureMember = {
    userId: string;
    /**
     * User's display name
     */
    userName: string;
    /**
     * User's email address
     */
    userEmail: string;
    hasSigned: boolean;
    signedAt: string | null;
  };
  export type GroupSignatureList = { members: Array<GroupSignatureMember>; totalMembers: number; signedCount: number };
  export type RevokeSignatureResponse = { message: string };
  export type NewsArticle = {
    /**
     * News article ID
     */
    id: string;
    /**
     * News article title
     */
    title: string;
    /**
     * News article subtitle/ingress
     */
    header: string;
    /**
     * Main content
     */
    body: string;
    /**
     * Image URL
     */
    imageUrl: string | null;
    /**
     * Image alt text
     */
    imageAlt: string | null;
    /**
     * Whether reactions are enabled
     */
    emojisAllowed: boolean;
    /**
     * When the article was archived (ISO 8601), or null if it is live
     */
    archivedAt: string | null;
    /**
     * Creator user ID
     */
    createdById: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
    /**
     * Creator user info
     */
    creator: { id: string; name: string } | null;
    reactions: Array<{
      userId: string;
      newsId: string;
      emoji: string;
      createdAt: string;
      user: { id: string; name: string };
    }>;
  };
  export type CreateNews = {
    /**
     * News article title
     */
    title: string;
    /**
     * News article subtitle/ingress
     */
    header: string;
    /**
     * Main content of the news
     */
    body: string;
    /**
     * Optional image URL
     */
    imageUrl?: string;
    /**
     * Alt text for the image
     */
    imageAlt?: string;
    /**
     * Whether reactions are enabled
     */
    emojisAllowed?: boolean;
  };
  export type NewsListItem = {
    /**
     * News ID
     */
    id: string;
    /**
     * News title
     */
    title: string;
    /**
     * News header
     */
    header: string;
    /**
     * News body
     */
    body: string;
    /**
     * Image URL
     */
    imageUrl: string | null;
    /**
     * Image alt text
     */
    imageAlt: string | null;
    /**
     * Whether reactions are allowed
     */
    emojisAllowed: boolean;
    /**
     * When the article was archived (ISO 8601), or null if it is live
     */
    archivedAt: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
  };
  export type NewsList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of news articles
     */
    items: Array<NewsListItem>;
  };
  export type UpdateNews = Partial<{
    title: string;
    header: string;
    body: string;
    imageUrl: string | null;
    imageAlt: string | null;
    emojisAllowed: boolean;
    /**
     * Archive or restore the article. An archived article disappears from the public news pages but stays in the admin panel.
     */
    archived: boolean;
  }>;
  export type DeleteNewsResponse = { message: string };
  export type NewsReaction = {
    /**
     * User ID
     */
    userId: string;
    /**
     * News article ID
     */
    newsId: string;
    /**
     * Emoji reaction
     */
    emoji: string;
    /**
     * Reaction creation time (ISO 8601)
     */
    createdAt: string;
  };
  export type CreateNewsReaction = {
    /**
     * Emoji reaction (e.g., 👍, ❤️, 😂)
     */
    emoji: string;
  };
  export type DeleteNewsReactionResponse = { message: string };
  export type ToddelIssue = {
    /**
     * Lepton's running count, not the number on the cover
     */
    edition: number;
    /**
     * Title of the issue
     */
    title: string;
    /**
     * Cover image, if one was published
     */
    imageUrl: string | null;
    /**
     * The issue itself, as a PDF
     */
    pdfUrl: string;
    /**
     * Publication date (ISO 8601)
     */
    publishedAt: string;
  };
  /**
   * Every issue, newest first
   */
  export type ToddelList = Array<ToddelIssue>;
  export type CreateToddel = {
    /**
     * Running count, continuing where the archive left off — not the number printed on the cover
     */
    edition: number;
    /**
     * Title of the issue, e.g. “Töddel”
     */
    title: string;
    /**
     * Publication date (ISO 8601)
     */
    publishedAt: string;
    /**
     * Asset key of the PDF, from POST /api/assets
     */
    pdfKey: string;
    /**
     * Asset key of the cover image, if there is one
     */
    imageKey?: string | null;
  };
  /**
   * Only the given fields are changed
   */
  export type UpdateToddel = Partial<{
    /**
     * Title of the issue, e.g. “Töddel”
     */
    title: string;
    /**
     * Publication date (ISO 8601)
     */
    publishedAt: string;
    /**
     * Asset key of the PDF, from POST /api/assets
     */
    pdfKey: string;
    /**
     * Asset key of the cover image, if there is one
     */
    imageKey: string | null;
  }>;
  export type DeleteToddelResponse = { message: string };
  export type RoleUser = { userId: string; name: string | null; image: string | null };
  export type Role = {
    id: number;
    name: string;
    description: string | null;
    position: number;
    permissions: Array<string>;
    users: Array<RoleUser>;
    createdAt: string;
    updatedAt: string;
  };
  export type RoleList = Array<Role>;
  export type CreateRole = {
    /**
     * Unique role name
     */
    name: string;
    description?: string;
    /**
     * Permissions granted by this role
     */
    permissions?: Array<string>;
  };
  export type UpdateRole = Partial<{
    name: string;
    description: string | null;
    /**
     * Permissions granted by this role
     */
    permissions: Array<string>;
  }>;
  export type RoleMessage = { message: string };
  export type AssignRole = {
    /**
     * User to assign
     */
    userId: string;
  };
  export type JobDetail = {
    /**
     * Job posting ID
     */
    id: string;
    /**
     * Job title
     */
    title: string;
    /**
     * Short description
     */
    ingress: string;
    /**
     * Full job description
     */
    body: string;
    /**
     * Company name
     */
    company: string;
    /**
     * Job location
     */
    location: string;
    /**
     * Application deadline (ISO 8601)
     */
    deadline: string | null;
    /**
     * Is continuously hiring
     */
    isContinuouslyHiring: boolean;
    /**
     * Job type
     */
    jobType: "full_time" | "part_time" | "summer_job" | "other";
    /**
     * Contact email
     */
    email: string | null;
    /**
     * Application link
     */
    link: string | null;
    /**
     * Minimum year of study
     */
    classStart: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    /**
     * Maximum year of study
     */
    classEnd: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    /**
     * Image URL
     */
    imageUrl: string | null;
    /**
     * Image alt text
     */
    imageAlt: string | null;
    /**
     * Creator user ID
     */
    createdById: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
    /**
     * Creator user info
     */
    creator: { id: string; name: string } | null;
    /**
     * Whether the job posting has expired
     */
    expired: boolean;
  };
  export type CreateJob = {
    /**
     * Job posting title
     */
    title: string;
    /**
     * Short description/summary
     */
    ingress?: string;
    /**
     * Full job description
     */
    body?: string;
    /**
     * Company name
     */
    company: string;
    /**
     * Job location
     */
    location: string;
    /**
     * Application deadline
     */
    deadline: string;
    /**
     * Whether hiring is ongoing
     */
    isContinuouslyHiring?: boolean;
    /**
     * Type of employment
     */
    jobType?: "full_time" | "part_time" | "summer_job" | "other";
    /**
     * Contact email
     */
    email?: string;
    /**
     * Application or company URL
     */
    link?: string;
    /**
     * Target class start
     */
    classStart?: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    /**
     * Target class end
     */
    classEnd?: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    /**
     * Company logo
     */
    imageUrl?: string;
    /**
     * Logo alt text
     */
    imageAlt?: string;
  };
  export type JobListItem = {
    /**
     * Job posting ID
     */
    id: string;
    /**
     * Job title
     */
    title: string;
    /**
     * Short description
     */
    ingress: string;
    /**
     * Full job description
     */
    body: string;
    /**
     * Company name
     */
    company: string;
    /**
     * Job location
     */
    location: string;
    /**
     * Application deadline (ISO 8601)
     */
    deadline: string | null;
    /**
     * Is continuously hiring
     */
    isContinuouslyHiring: boolean;
    /**
     * Job type
     */
    jobType: "full_time" | "part_time" | "summer_job" | "other";
    /**
     * Contact email
     */
    email: string | null;
    /**
     * Application link
     */
    link: string | null;
    /**
     * Minimum year of study
     */
    classStart: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    /**
     * Maximum year of study
     */
    classEnd: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    /**
     * Image URL
     */
    imageUrl: string | null;
    /**
     * Image alt text
     */
    imageAlt: string | null;
    /**
     * Creator user ID
     */
    createdById: string | null;
    /**
     * Creation time (ISO 8601)
     */
    createdAt: string;
    /**
     * Last update time (ISO 8601)
     */
    updatedAt: string;
    /**
     * Whether the job posting has expired
     */
    expired: boolean;
  };
  export type JobList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    /**
     * List of job postings
     */
    items: Array<JobListItem>;
  };
  export type UpdateJob = Partial<{
    title: string;
    ingress: string;
    body: string;
    company: string;
    location: string;
    deadline: string;
    isContinuouslyHiring: boolean;
    jobType: "full_time" | "part_time" | "summer_job" | "other";
    email: string | null;
    link: string | null;
    classStart: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    classEnd: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
    imageUrl: string | null;
    imageAlt: string | null;
  }>;
  export type DeleteJobResponse = { message: string };
  export type CalendarSubscription = {
    /**
     * Personal iCalendar (.ics) URL the user subscribes to in their calendar app. Contains a secret token — treat it like a password.
     */
    url: string;
  };
  export type UserSettings = {
    gender: "male" | "female" | "other";
    allowsPhotosByDefault: boolean;
    acceptsEventRules: boolean;
    imageUrl?: string | "";
    bioDescription?: string;
    githubUrl?: string | "";
    linkedinUrl?: string | "";
    receiveMailCommunication: boolean;
    publicEventRegistrations: boolean;
    allergies: Array<string>;
    customAllergies: Array<string>;
    /**
     * Whether the user has completed onboarding
     */
    isOnboarded: boolean;
    /**
     * When the member last answered the allergy question, including when the answer was «none». Null means they have never answered.
     */
    allergiesConfirmedAt: string | null;
  };
  export type UserSettingsBase = {
    gender: "male" | "female" | "other";
    allowsPhotosByDefault: boolean;
    acceptsEventRules: boolean;
    imageUrl?: string | "";
    bioDescription?: string;
    githubUrl?: string | "";
    linkedinUrl?: string | "";
    receiveMailCommunication: boolean;
    publicEventRegistrations: boolean;
    allergies: Array<string>;
    customAllergies: Array<string>;
  };
  export type OnboardUserInput = {
    gender: "male" | "female" | "other";
    allowsPhotosByDefault: boolean;
    acceptsEventRules: boolean;
    imageUrl?: string | "";
    bioDescription?: string;
    githubUrl?: string | "";
    linkedinUrl?: string | "";
    receiveMailCommunication: boolean;
    publicEventRegistrations?: boolean;
    allergies?: Array<string>;
    customAllergies?: Array<string>;
  };
  export type UpdateUserSettings = {
    gender: "male" | "female" | "other";
    allowsPhotosByDefault: boolean;
    acceptsEventRules: boolean;
    imageUrl?: string | "";
    bioDescription?: string;
    githubUrl?: string | "";
    linkedinUrl?: string | "";
    receiveMailCommunication: boolean;
    publicEventRegistrations: boolean;
    allergies: Array<string>;
    customAllergies: Array<string>;
    /**
     * When the member last answered the allergy question, including when the answer was «none». Null means they have never answered.
     */
    allergiesConfirmedAt: string | null;
  };
  export type UpdateUserSettingsInput = Partial<{
    gender: "male" | "female" | "other";
    allowsPhotosByDefault: boolean;
    acceptsEventRules: boolean;
    imageUrl: string | "";
    bioDescription: string;
    githubUrl: string | "";
    linkedinUrl: string | "";
    receiveMailCommunication: boolean;
    publicEventRegistrations: boolean;
    allergies: Array<string>;
    customAllergies: Array<string>;
  }>;
  export type SetPasswordResponse = { success: boolean };
  export type SetPasswordInput = {
    /**
     * The password to set. Length is checked against Better Auth's own bounds, since those are what sign-in enforces.
     */
    newPassword: string;
  };
  export type UnansweredEvaluations = Array<{
    /**
     * Form to answer
     */
    formId: string;
    formTitle: string;
    eventId: string;
    eventTitle: string;
    /**
     * When the event ended
     */
    eventEndTime: string;
  }>;
  export type AllergyList = Array<Allergy>;
  export type RegisterUser = {
    /**
     * The new user's id
     */
    id: string;
    /**
     * Derived from the e-mail's local part
     */
    username: string;
    email: string;
    emailVerificationRequired: true;
  };
  export type RegisterUserInput = {
    /**
     * The member's full name
     */
    name: string;
    /**
     * The member's address. Must be @stud.ntnu.no unless 'username' is given, since the username is otherwise derived from it
     */
    email: string;
    /**
     * The password the member chose
     */
    password: string;
    /**
     * Slug of the STUDY group to enrol the member in, e.g. 'dataingenir'
     */
    studyProgramSlug: string;
    /**
     * The NTNU username to give the member, for callers registering students who have not been given their @stud.ntnu.no address yet. Should be the member's Feide username, so a later Feide login lands on this same account. Omit to derive it from the address.
     */
    username?: string;
  };
  export type UserSearchResult = Array<{
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  }>;
  export type UserListItem = {
    /**
     * User ID
     */
    id: string;
    /**
     * User display name
     */
    name: string;
    /**
     * Username
     */
    username: string | null;
    /**
     * Profile image URL
     */
    image: string | null;
    /**
     * Name of the user's study programme, derived from their STUDY group membership. Null when they have none.
     */
    studyProgram: string | null;
    /**
     * The year the user started studying (kull), derived from their STUDYYEAR group membership. Null when unknown.
     */
    studyStartYear: number | null;
    /**
     * Class level 1-5, computed from the current programme and its length. A master's first year is 4. Null for alumni and for anyone we cannot place — served by the API so the rule lives in one place rather than being recomputed per client.
     */
    classYear: number | null;
    /**
     * Past the programme's length, on positive evidence: we know the programme, we know the start year, and even the earliest reading of it is beyond the length. A separate field because `classYear` is null both for the member who has finished and for the one we cannot place at all.
     */
    isAlumni: boolean;
    /**
     * False when the account is deactivated — the member cannot sign in.
     */
    isActive: boolean;
    /**
     * 'pending' for a self-registered account still waiting for an admin, 'approved' once one said yes. Null for accounts that never needed approving — Feide logins and members migrated from Lepton.
     */
    approvalStatus: ("pending" | "approved") | null;
    /**
     * The account's e-mail address. Shown to the admins who hold 'users:view', who need it both to judge a stranger waiting for approval and to get hold of an ordinary member.
     */
    email: string | null;
    /**
     * The member/alumni baseline role the account holds, or null for an account holding neither — a stranger, or someone Feide has never confirmed either way. Only 'member' carries the right to register for events.
     */
    baselineRole: ("member" | "alumni") | null;
    /**
     * Account states an admin has to act on, none of which are visible from the other fields. 'no-baseline-role': holds neither member nor alumni, so every event registration is a 403 while the account otherwise looks healthy — never set for an account still awaiting approval, which is meant to hold no role and is already on the approval list. 'feide-inactive': Feide reported the study programme as not enrolled, which demotes the account to alumni on the next login. 'alumni-mismatch': marked alumni while the cohort places them inside the programme. Empty for the overwhelming majority.
     */
    issues: Array<"no-baseline-role" | "feide-inactive" | "alumni-mismatch">;
    /**
     * Account creation timestamp
     */
    createdAt: string;
  };
  export type UserList = {
    /**
     * Total number of items available
     */
    totalCount: number;
    /**
     * Total number of pages available
     */
    pages: number;
    /**
     * The next page number that can be fetched
     */
    nextPage: number | null;
    items: Array<UserListItem>;
  };
  export type UpdateStudyYear = {
    message: string;
    /**
     * The cohort year now stored
     */
    startYear: number | null;
  };
  export type UpdateStudyYearInput = {
    /**
     * Cohort start year, e.g. 2026. Null clears the cohort and removes the member's STUDYYEAR group.
     */
    startYear: number | null;
    /**
     * Which study programme the year applies to, e.g. 'digital-samhandling'. Omit to correct the member's current programme, which is what the admin list shows. Only members who have switched studies have more than one.
     */
    studyProgramSlug?: string | null;
  };
  export type UpdateStudy = {
    message: string;
    /**
     * Name of the programme now stored
     */
    studyProgram: string | null;
    /**
     * Slug of the programme now stored
     */
    studyProgramSlug: string | null;
  };
  export type UpdateStudyInput = {
    /**
     * Slug of the STUDY group the member should be on, e.g. 'dataingenir'. Replaces the one they have; null removes it.
     */
    studyProgramSlug: string | null;
  };
  export type UserAllergies = { allergies: Array<Allergy> };
  export type UpdateUserAllergiesInput = {
    /**
     * Allergy slugs the member should have. Replaces the current set.
     */
    allergies: Array<string>;
  };
  export type UpdateUserStatus = { message: string; isActive: boolean };
  export type UpdateUserStatusInput = {
    /**
     * False deactivates the account: the member can no longer sign in, and their sessions are ended.
     */
    isActive: boolean;
    /**
     * Why the account was deactivated. Ignored when activating.
     */
    reason?: string;
  };
  export type UpdateUserBaselineRole = { message: string; role: "member" | "alumni" };
  export type UpdateUserBaselineRoleInput = {
    /**
     * 'member' can register for events; 'alumni' keeps everything else but loses that right. Setting one removes the other.
     */
    role: "member" | "alumni";
  };
  export type ApproveUser = { message: string; approvalStatus: "approved"; role: "member" | "alumni" };
  export type ApproveUserInput = Partial<{
    /**
     * Which baseline role the account gets. Defaults to 'member'. Pick 'alumni' for a former member — they keep every kind of access except registering for events.
     */
    role: "member" | "alumni";
  }>;
  export type UserProfile = {
    /**
     * User ID
     */
    id: string;
    /**
     * User display name
     */
    name: string;
    /**
     * Username
     */
    username: string | null;
    /**
     * The user's e-mail address. Only filled in for viewers holding 'users:view', and for the user themselves. Null for everyone else — it is not part of the public profile.
     */
    email: string | null;
    /**
     * Profile image URL — the uploaded avatar when there is one, otherwise the one from Feide
     */
    image: string | null;
    /**
     * Free-text bio
     */
    bio: string | null;
    /**
     * Link to the user's GitHub profile
     */
    githubUrl: string | null;
    /**
     * Link to the user's LinkedIn profile
     */
    linkedinUrl: string | null;
    /**
     * Name of the user's study programme, derived from their STUDY group membership. Null when they have none.
     */
    studyProgram: string | null;
    /**
     * The year the user started their current study programme. Falls back to their STUDYYEAR group when we have no year for the programme itself. Null when unknown.
     */
    studyStartYear: number | null;
    /**
     * Class level 1-5, computed from the current programme and its length. A master's first year is 4. Null for alumni and for anyone we cannot place — served by the API so the rule lives in one place rather than being recomputed per client.
     */
    classYear: number | null;
    /**
     * Every group the user belongs to, including the derived STUDY/STUDYYEAR groups
     */
    groups: Array<{ slug: string; name: string; type: string; logoUrl: string | null; role: string }>;
    /**
     * Groups the user used to belong to, most recent first. Groups they rejoined appear under `groups` instead, and a group left more than once is listed once, by the latest stint. As public as the active memberships above.
     */
    formerGroups: Array<{
      slug: string;
      name: string;
      type: string;
      logoUrl: string | null;
      role: string;
      startedAt: string;
      endedAt: string;
    }>;
    /**
     * Account creation timestamp
     */
    createdAt: string;
  };

  // </Schemas>
}

export namespace Endpoints {
  // <Endpoints>

  /**
   * What is actually running right now. A deploy is only finished once the host has swapped the container, which is minutes after the workflow reports success — and the workflow reporting success is not evidence that it happened. Before this route, the only way to tell from outside was to find a schema that happened to change in that release; 2026-08-22.release-1 changed none, so its deploy could not be confirmed at all. Public, and carries nothing but build metadata.
   */
  export type get_GetVersion = {
    method: "GET";
    path: "/api/version";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.Version };
  };
  /**
   * Create a new API key. The full key is returned only once and cannot be retrieved again. Requires 'api-keys:create' permission.
   */
  export type post_CreateApiKey = {
    method: "POST";
    path: "/api/api-keys";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateApiKey;
    };
    responses: {
      201: Schemas.CreateApiKeyResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Get a list of all API keys. Does not include the full key values. Requires 'api-keys:view' permission.
   */
  export type get_ListApiKeys = {
    method: "GET";
    path: "/api/api-keys";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.ApiKeyList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Get a single API key by ID. Does not include the full key value. Requires 'api-keys:view' permission.
   */
  export type get_GetApiKey = {
    method: "GET";
    path: "/api/api-keys/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.ApiKey;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Update an API key's metadata (name, description, permissions, metadata). Cannot update the key itself - use regenerate for that. Requires 'api-keys:update' permission.
   */
  export type patch_UpdateApiKey = {
    method: "PATCH";
    path: "/api/api-keys/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateApiKey;
    };
    responses: {
      200: Schemas.ApiKey;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete an API key. This action is irreversible. Requires 'api-keys:delete' permission.
   */
  export type delete_DeleteApiKey = {
    method: "DELETE";
    path: "/api/api-keys/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteApiKeyResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Generate a new key value for an existing API key. The old key will be invalidated. The new full key is returned only once and cannot be retrieved again. Requires 'api-keys:update' permission.
   */
  export type post_RegenerateApiKey = {
    method: "POST";
    path: "/api/api-keys/{id}/regenerate";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.CreateApiKeyResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Check if an API key is valid and return its details. This is a public endpoint that does not require authentication. Updates the lastUsedAt timestamp if the key is valid.
   */
  export type post_ValidateApiKey = {
    method: "POST";
    path: "/api/api-keys/validate";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.ValidateApiKeyInput;
    };
    responses: { 200: Schemas.ValidateApiKeyResponse; 400: { success: false; error: Array<unknown>; data: unknown } };
  };
  /**
   * Groups selectable in the application forms, their økonomiansvarlig addresses, and the budget/case type labels.
   */
  export type get_GetApplicationOptions = {
    method: "GET";
    path: "/api/applications/options";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.ApplicationOptions; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Lists the authenticated user's own applications and their processing status.
   */
  export type get_ListMyApplications = {
    method: "GET";
    path: "/api/applications/mine";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        type: "expense" | "support" | "sports_support" | "hs_case" | "company_contact";
        status: "new" | "in_progress" | "approved" | "rejected";
        limit: number;
        offset: number;
      }>;
    };
    responses: {
      200: Schemas.ApplicationList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Submit an utlegg. Any authenticated member may submit; the claim is handled by the Finansminister.
   */
  export type post_CreateExpenseApplication = {
    method: "POST";
    path: "/api/applications/expense";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateExpenseApplication;
    };
    responses: {
      201: Schemas.CreateApplicationResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Submit a søknad om støtte. Handled by the Finansminister and Hovedstyret.
   */
  export type post_CreateSupportApplication = {
    method: "POST";
    path: "/api/applications/support";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateSupportApplication;
    };
    responses: {
      201: Schemas.CreateApplicationResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Submit a søknad om støtte til idrettslag. Handled by IdKom.
   */
  export type post_CreateSportsSupportApplication = {
    method: "POST";
    path: "/api/applications/sports-support";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateSupportApplication;
    };
    responses: {
      201: Schemas.CreateApplicationResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Submit a sak til HS. A Vedtakssak must include a recommendation.
   */
  export type post_CreateHsCaseApplication = {
    method: "POST";
    path: "/api/applications/hs-case";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateHsCaseApplication;
    };
    responses: {
      201: Schemas.CreateApplicationResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Lists applications the caller is allowed to handle. Results are limited to the types they have view permission for.
   */
  export type get_ListApplications = {
    method: "GET";
    path: "/api/applications";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        type: "expense" | "support" | "sports_support" | "hs_case" | "company_contact";
        status: "new" | "in_progress" | "approved" | "rejected";
        limit: number;
        offset: number;
      }>;
    };
    responses: {
      200: Schemas.ApplicationList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Streams the generated PDF. Available to the submitter and to handlers of that application type.
   */
  export type get_GetApplicationPdf = {
    method: "GET";
    path: "/api/applications/{id}/pdf";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: { 200: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Streams one of an application's attachments. Available to the submitter and to handlers of that application type.
   */
  export type get_GetApplicationAttachment = {
    method: "GET";
    path: "/api/applications/{id}/attachments/{assetKey}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string; assetKey: string };
    };
    responses: { 200: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Re-renders and stores the PDF for an application. Used when generation failed at submission time.
   */
  export type post_RegenerateApplicationPdf = {
    method: "POST";
    path: "/api/applications/{id}/pdf/regenerate";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.RegenerateApplicationPdfResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Sets the processing status and optional internal note. Approving or rejecting emails the submitter; moving to 'under behandling' does not.
   */
  export type patch_UpdateApplicationStatus = {
    method: "PATCH";
    path: "/api/applications/{id}/status";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateApplicationStatus;
    };
    responses: {
      200: Schemas.ApplicationDetail;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Returns a single application. Available to the submitter and to anyone with view permission for that application's type. The internal comment is only included for handlers.
   */
  export type get_GetApplication = {
    method: "GET";
    path: "/api/applications/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.ApplicationDetail;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Upload a file to staging. The file will be automatically cleaned up after 2 days if not promoted.
   *
   * Requires either session authentication or a valid API key.
   *
   * **Constraints:**
   * - Maximum file size: 50MB
   * - Allowed MIME types: image/jpeg, image/png, image/gif, image/webp, application/pdf
   *
   * **Image optimization:**
   * JPEG, PNG and WebP uploads are re-encoded to WebP, scaled to fit within 2560x2560 px and stripped of metadata. The response therefore reports the stored `contentType`, `size` and `originalFilename` (extension swapped to `.webp`), which may differ from what was sent. GIF is passed through untouched so animation survives.
   *
   * **Usage:**
   * Send the file as multipart/form-data with a field named "file".
   *
   * Pass an optional "visibility" field set to "private" for files that must not be served by the open `GET /api/assets/:key` route — those are only reachable through a route that does its own authorization (e.g. application attachments).
   */
  export type post_UploadAsset = {
    method: "POST";
    path: "/api/assets";
    requestFormat: "form-data";
    responseFormat: "json";
    parameters: {
      body: { file: Blob; visibility?: "public" | "private" };
    };
    responses: { 201: Schemas.UploadResponse; 400: unknown; 401: Schemas.HTTPAppException; 507: unknown };
  };
  /**
   * Get metadata for an asset by its key. No authentication required.
   *
   * The key is the full path returned when uploading, e.g., `uploads/2024/01/uuid_filename.jpg`
   *
   * Private assets are reported as missing here, exactly as `GET /api/assets/:key`
   * reports them — the size and filename of a fine's evidence picture are no more
   * public than its bytes.
   */
  export type get_GetAssetMetadata = {
    method: "GET";
    path: "/api/assets/metadata/{key}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { key: string };
    };
    responses: { 200: Schemas.AssetMetadata; 404: unknown };
  };
  /**
   * Mark an uploaded asset as claimed so it survives the staging cleanup that deletes unclaimed uploads after 2 days.
   *
   * The key is the full path returned when uploading, e.g. `uploads/2026/08/uuid_filename.webp`.
   *
   * Call this once the URL has been stored somewhere permanent. Routes within Photon do it for you; external clients that keep the URL in their own database must call it themselves.
   *
   * Only the account that uploaded the asset may promote it. Promoting an already-promoted asset is a no-op and still answers 200.
   */
  export type post_PromoteAsset = {
    method: "POST";
    path: "/api/assets/promote/{key}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { key: string };
    };
    responses: {
      200: Schemas.AssetMetadata;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Download a file by its key.
   *
   * The key is the full path returned when uploading, e.g., `uploads/2024/01/uuid_filename.jpg`
   *
   * Most assets — nyhets- og arrangementsbilder, gruppelogoer, Töddel — need no
   * authentication. Galleribilder og profilbilder do: they answer 404 unless the
   * request carries a session. Contract signatures, application attachments and
   * fine pictures are never served here at all; they are only reachable through
   * routes that perform their own authorization.
   *
   * **Resized variants:**
   * Pass `?w=` with one of 160, 320, 480, 640, 960, 1280, 1920 to get the image
   * re-encoded as WebP at that width, keeping its aspect ratio and never upscaling.
   * Variants are generated on first request and cached, so a card never has to
   * download a full-resolution original. Any other width is rejected, and the
   * parameter is ignored for non-image assets (PDF, GIF).
   */
  export type get_DownloadAsset = {
    method: "GET";
    path: "/api/assets/{key}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { key: string };
    };
    responses: { 200: unknown; 400: unknown; 404: unknown };
  };
  /**
   * Banners whose visibility window covers the current moment, newest first. Public endpoint — this is what the front page renders.
   */
  export type get_ListVisibleBanners = {
    method: "GET";
    path: "/api/banners/visible";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.VisibleBannerList };
  };
  /**
   * Every banner regardless of visibility window, for the admin panel. Requires 'banners:view' or 'banners:manage', held globally or for any single group. There are only ever a handful of banners, so the list is unpaginated.
   */
  export type get_ListBanners = {
    method: "GET";
    path: "/api/banners";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.BannerList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Create a new front-page banner. Requires 'banners:create' or 'banners:manage', held globally or for any single group.
   */
  export type post_CreateBanner = {
    method: "POST";
    path: "/api/banners";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateBanner;
    };
    responses: {
      201: Schemas.Banner;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Update a banner. Requires 'banners:update' or 'banners:manage', held globally or for any single group.
   */
  export type patch_UpdateBanner = {
    method: "PATCH";
    path: "/api/banners/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateBanner;
    };
    responses: {
      200: Schemas.Banner;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a banner. Requires 'banners:delete' or 'banners:manage', held globally or for any single group.
   */
  export type delete_DeleteBanner = {
    method: "DELETE";
    path: "/api/banners/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteBannerResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Last resort for a member migrated from Lepton whose stored username differs from their NTNU one and who no longer has the email the old account was registered with — nothing in the flow can verify them, so this notifies an admin to do it by hand. Rate limited per client.
   */
  export type post_RequestAccountLinkHelp = {
    method: "POST";
    path: "/api/account-link/help";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.AccountLinkHelp;
    };
    responses: { 200: Schemas.AccountLinkHelpResponse; 400: unknown; 429: unknown };
  };
  /**
   * Reads the caller's study programmes, cohort and campus from Feide and applies them, including derived study groups and the member/alumni role. Run after linking a Feide account, which cannot sync on its own. Safe to repeat.
   */
  export type post_SyncFeideAccount = {
    method: "POST";
    path: "/api/account-link/sync";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.AccountLinkSyncResponse; 401: Schemas.HTTPAppException; 409: unknown; 502: unknown };
  };
  /**
   * Public endpoint used by the company landing page. Stores the enquiry as an application so the Næringslivsminister can handle it in /admin/kontaktskjema, and emails it to TIHLDE's business contact. Rate limited per client.
   */
  export type post_SubmitCompanyContact = {
    method: "POST";
    path: "/api/company/contact";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CompanyContact;
    };
    responses: { 200: Schemas.CompanyContactResponse; 400: unknown; 429: unknown };
  };
  /**
   * Send a custom email with structured content blocks. Requires API key authentication via Bearer token.
   */
  export type post_SendCustomEmail = {
    method: "POST";
    path: "/api/email/send";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.SendCustomEmail;
    };
    responses: {
      200: Schemas.SendEmailResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: unknown;
      403: unknown;
      503: unknown;
    };
  };
  /**
   * Retrieve members who currently have active strikes (prikker), each with the sum of their strikes and the strikes themselves. Paginates over members, not strikes, so a member's total is never split across pages. Requires 'events:strikes:view' or 'events:manage' permission; an organizer sees only the strikes from their own groups' events, and the total counts exactly those.
   */
  export type get_ListStrikesByMember = {
    method: "GET";
    path: "/api/event/strikes/members";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number }>;
    };
    responses: {
      200: Schemas.StrikesByUserList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Retrieve a paginated list of all strikes (prikker), including the affected user and the related event. Optionally filter by user. Requires 'events:strikes:view' or 'events:manage' permission, except when filtering on your own user ID.
   */
  export type get_ListStrikes = {
    method: "GET";
    path: "/api/event/strikes";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; userId: string }>;
    };
    responses: {
      200: Schemas.StrikeList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Give a user a strike (prikk) connected to an event. Requires 'events:strikes:create', or the right to arrange the event ('events:update' / 'events:manage') — globally or for the group arranging it.
   */
  export type post_CreateStrike = {
    method: "POST";
    path: "/api/event/strikes";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateStrike;
    };
    responses: {
      201: Schemas.Strike;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Retrieve a paginated list of past events you were registered for, newest first.
   */
  export type get_GetMyEventHistory = {
    method: "GET";
    path: "/api/event/my-registrations";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number }>;
    };
    responses: {
      200: Schemas.MyEventHistory;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Retrieve the events you are registered, waitlisted or pending for that have not ended yet, soonest first.
   */
  export type get_GetMyUpcomingEvents = {
    method: "GET";
    path: "/api/event/my-upcoming-registrations";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.MyUpcomingEvents; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Delete a strike (prikk) by its ID. Requires 'events:strikes:delete', or the right to arrange the event ('events:update' / 'events:manage') — globally or for the group arranging it.
   */
  export type delete_DeleteStrike = {
    method: "DELETE";
    path: "/api/event/strikes/{strikeId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { strikeId: string };
    };
    responses: {
      200: Schemas.DeleteStrikeResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Returns the events the token's owner is registered for as an iCalendar (.ics) feed. Authenticated by the secret token in the path, so calendar clients can subscribe to it directly.
   */
  export type get_GetCalendarFeed = {
    method: "GET";
    path: "/api/event/calendar/{token}/events.ics";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { token: string };
    };
    responses: { 200: string; 404: unknown };
  };
  /**
   * Mark or unmark an event as a favorite for the authenticated user
   */
  export type put_UpdateEventFavorite = {
    method: "PUT";
    path: "/api/event/favorite/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateFavoriteEvent;
    };
    responses: {
      200: Schemas.UpdateFavoriteResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Retrieve a list of all events you have marked as favorite.
   */
  export type get_GetFavoriteEvents = {
    method: "GET";
    path: "/api/event/favorite";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.FavoriteEvents; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Create a new event. Requires 'events:create' either globally or for the group arranging it.
   */
  export type post_CreateEvent = {
    method: "POST";
    path: "/api/event";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateEventSchema;
    };
    responses: {
      201: Schemas.CreateEventResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Retrieve a paginated list of all events with basic information including organizer and category details
   */
  export type get_ListEvents = {
    method: "GET";
    path: "/api/event";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        pageSize: number;
        page: number;
        search: string;
        category: Array<string>;
        expired: boolean;
        openSignUp: boolean;
        startFrom: string;
        startBefore: string;
        organizerGroupSlug: string;
        ordering: "upcoming" | "newest" | "oldest";
      }>;
    };
    responses: { 200: Schemas.EventList; 400: { success: false; error: Array<unknown>; data: unknown } };
  };
  /**
   * Update an event by its ID. Event creators can update their own events. Users with 'events:update' or 'events:manage' — globally or for the arranging group — can update the events they hold it for.
   */
  export type put_UpdateEvent = {
    method: "PUT";
    path: "/api/event/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateEventSchema;
    };
    responses: {
      200: Schemas.UpdateEventResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete an event by its ID. Event creators can delete their own events. Users with 'events:delete' — globally or for the arranging group — can delete any event they hold it for. This action is irreversible and will remove all associated data, including registrations and feedback.
   */
  export type delete_DeleteEvent = {
    method: "DELETE";
    path: "/api/event/{eventId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: {
      200: Schemas.DeleteEventResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Retrieve detailed information about a specific event, including registration status for the authenticated user if available
   */
  export type get_GetEvent = {
    method: "GET";
    path: "/api/event/{eventId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: { 200: Schemas.Event };
  };
  /**
   * Create a new registration for the authenticated user to attend an event, initially with pending status. Requires the 'events:registrations:create' permission — granted by the member baseline role (active students), not by the alumni role — unless the event has openToAlumni set, which lets alumni register for that event alone.
   */
  export type post_CreateEventRegistration = {
    method: "POST";
    path: "/api/event/{eventId}/registration";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };

      body: Schemas.CreateEventRegistrationBody;
    };
    responses: {
      200: Schemas.EventRegistration;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Retrieve a paginated list of users registered for a specific event. Members only — who attends is not something the open internet gets to enumerate; the event itself carries a public `registeredCount` for the visible number. Event admins additionally receive email, registration time, waitlist position and payment status, and may filter by registration status.
   */
  export type get_ListEventRegistrations = {
    method: "GET";
    path: "/api/event/{eventId}/registration";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; status: string }>;
      path: { eventId: string };
    };
    responses: {
      200: Schemas.EventRegistrationList;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Remove the authenticated user's registration from an event. If the event can cause strikes and the user unregisters from a confirmed spot after the cancellation deadline, they are given 1 strike. Registrations with a completed payment cannot be cancelled by the user.
   */
  export type delete_DeleteEventRegistration = {
    method: "DELETE";
    path: "/api/event/{eventId}/registration";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: { 200: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Add a confirmed participant and include them in the event's priority-user list, including before registration opens or after it closes. Requires events:update or events:manage globally or for the arranging group. Bypasses self-registration eligibility and strike delays, but requires available capacity; pending registrations reserve capacity too. Payment obligations still apply. Events without sign-up, full events and existing active registrations are rejected. Cancelled registrations are reused.
   */
  export type post_AdminCreateEventRegistration = {
    method: "POST";
    path: "/api/event/{eventId}/registration/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string; userId: string };

      body: Schemas.CreateEventRegistrationBody;
    };
    responses: {
      200: Schemas.EventRegistration;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Mark a registered user as attended (checked in) or revert them to registered. Used for event check-in; users left as 'registered' after the event may receive no-show strikes. Requires 'events:update' or 'events:manage', globally or for the arranging group.
   */
  export type patch_SetRegistrationAttendance = {
    method: "PATCH";
    path: "/api/event/{eventId}/registration/{userId}/attendance";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string; userId: string };

      body: Schemas.SetAttendance;
    };
    responses: {
      200: Schemas.Attendance;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * The allergies among everyone holding a spot on the event, for the arrangør who orders the food. Returns totals per allergy alongside the per-person detail, and counts how many have never answered — which is not the same as having none. Restricted to the people who run this event; allergies are health data, so the access follows the arrangement rather than a global permission.
   */
  export type get_GetEventAllergies = {
    method: "GET";
    path: "/api/event/{eventId}/allergies";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: { 200: Schemas.EventAllergies; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Everything the arrangers have sent to the participants, newest first, along with how many a new message would reach. Same access as editing the event.
   */
  export type get_ListEventMessages = {
    method: "GET";
    path: "/api/event/{eventId}/messages";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: {
      200: Schemas.EventMessageList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Sends a message to everyone holding a spot on the event (registered, attended or no-show — never the waitlist) as a notification in the bell, an email and a push. Replies to the email go to the event's contact person, or the arranging group's contact address. Same access as editing the event.
   */
  export type post_SendEventMessage = {
    method: "POST";
    path: "/api/event/{eventId}/messages";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };

      body: Schemas.EventMessageContent;
    };
    responses: {
      201: Schemas.EventMessage;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Sends the message as an email and a push to the caller only, with «[Test]» in front of the title. Nothing is saved, and the bell is left alone.
   */
  export type post_TestEventMessage = {
    method: "POST";
    path: "/api/event/{eventId}/messages/test";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };

      body: Schemas.EventMessageContent;
    };
    responses: {
      204: unknown;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Initiates a Vipps payment for an event registration. User must have a registered status for the event.
   */
  export type post_CreateEventPayment = {
    method: "POST";
    path: "/api/event/{eventId}/payment";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };

      body: Schemas.CreatePaymentBody;
    };
    responses: {
      201: Schemas.CreatePaymentResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Asks the payment provider what happened to the caller's outstanding checkout for this event, and records a completed payment. Meant for the moment the member returns from Vipps, before the webhook has arrived.
   */
  export type post_ConfirmEventPayment = {
    method: "POST";
    path: "/api/event/{eventId}/payment/confirm";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: {
      200: Schemas.ConfirmPaymentResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Retrieve a paginated list of every payment for an event, including the payer and a status summary. Requires 'events:payments:view', 'events:manage' or 'events:update' — or being the event's creator.
   */
  export type get_ListEventPayments = {
    method: "GET";
    path: "/api/event/{eventId}/payments";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; status: "pending" | "paid" | "refunded" | "failed" }>;
      path: { eventId: string };
    };
    responses: {
      200: Schemas.EventPaymentList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Reverse a completed payment with the payment provider and mark it as refunded. The full remaining refundable amount is returned to the payer. This does not cancel the registration — free the spot separately if that is wanted. Requires 'events:payments:refund', globally or for the arranging group.
   */
  export type post_RefundEventPayment = {
    method: "POST";
    path: "/api/event/{eventId}/payments/{paymentId}/refund";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string; paymentId: string };
    };
    responses: {
      200: Schemas.RefundEventPayment;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
      502: unknown;
    };
  };
  /**
   * Webhook endpoint for Vipps to notify about payment status changes. Updates payment record based on Vipps payment state.
   */
  export type post_HandlePaymentWebhook = {
    method: "POST";
    path: "/api/event/payment/webhook";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: unknown; 400: unknown; 401: unknown; 404: unknown };
  };
  /**
   * Create a survey or evaluation form for an event. Requires event write permission.
   */
  export type post_CreateEventForm = {
    method: "POST";
    path: "/api/event/{eventId}/forms";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };

      body: Schemas.CreateEventForm;
    };
    responses: {
      201: Schemas.CreateEventFormResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Get all forms (survey and evaluation) for an event
   */
  export type get_ListEventForms = {
    method: "GET";
    path: "/api/event/{eventId}/forms";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: {
      200: Schemas.EventFormList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Get a specific form (survey or evaluation) for an event with all fields and options
   */
  export type get_GetEventForm = {
    method: "GET";
    path: "/api/event/{eventId}/forms/{type}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string; type: "survey" | "evaluation" };
    };
    responses: {
      200: Schemas.EventFormDetail;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Add or update emoji reaction to an event. Each user has at most one reaction per event, so reacting again replaces it. Requires authentication.
   */
  export type post_CreateEventReaction = {
    method: "POST";
    path: "/api/event/{eventId}/reactions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };

      body: Schemas.CreateEventReaction;
    };
    responses: {
      201: Schemas.EventReaction;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Remove your emoji reaction from an event.
   */
  export type delete_DeleteEventReaction = {
    method: "DELETE";
    path: "/api/event/{eventId}/reactions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { eventId: string };
    };
    responses: {
      200: Schemas.DeleteEventReactionResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Paginated list of ideas and bug reports. Unresolved items come first, closed and rejected ones last; newest first within each. Requires authentication.
   */
  export type get_ListFeedback = {
    method: "GET";
    path: "/api/feedback";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        pageSize: number;
        page: number;
        type: "idea" | "bug";
        status: "open" | "in_progress" | "closed" | "rejected";
        search: string;
      }>;
    };
    responses: {
      200: Schemas.FeedbackList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * File an idea or a bug report. Any logged-in member may do this — no permission needed.
   */
  export type post_CreateFeedback = {
    method: "POST";
    path: "/api/feedback";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateFeedback;
    };
    responses: {
      201: Schemas.FeedbackItem;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Edit a piece of feedback, or move it along its status. Requires 'feedback:update' or 'feedback:manage', or being the author. Only the author may edit the title, description and anonymity, and only while it is open and nobody else has voted or commented. Only the permission may change the status or the rejection reason. Rejecting notifies the author.
   */
  export type patch_UpdateFeedback = {
    method: "PATCH";
    path: "/api/feedback/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateFeedback;
    };
    responses: {
      200: Schemas.FeedbackItem;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Delete a piece of feedback. Requires 'feedback:delete' or 'feedback:manage', or being the author while it is still open and nobody else has voted or commented.
   */
  export type delete_DeleteFeedback = {
    method: "DELETE";
    path: "/api/feedback/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.FeedbackMessageResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * A single idea or bug report. Requires authentication.
   */
  export type get_GetFeedback = {
    method: "GET";
    path: "/api/feedback/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.FeedbackItem;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Cast or change your vote on a piece of feedback. One vote per user — voting again replaces the previous one.
   */
  export type put_VoteFeedback = {
    method: "PUT";
    path: "/api/feedback/{id}/vote";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.VoteFeedback;
    };
    responses: {
      200: Schemas.FeedbackVoteCounts;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Take back your vote on a piece of feedback.
   */
  export type delete_DeleteFeedbackVote = {
    method: "DELETE";
    path: "/api/feedback/{id}/vote";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.FeedbackVoteCounts;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Replies from Index and the author, oldest first. Visible to every logged-in member.
   */
  export type get_ListFeedbackComments = {
    method: "GET";
    path: "/api/feedback/{id}/comments";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.FeedbackCommentList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Reply in a feedback thread. Requires 'feedback:update' or 'feedback:manage', or being the author. A reply from Index notifies the author; a reply from the author notifies the Index members in the thread.
   */
  export type post_CreateFeedbackComment = {
    method: "POST";
    path: "/api/feedback/{id}/comments";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.CreateFeedbackComment;
    };
    responses: {
      201: Schemas.FeedbackComment;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a comment. Requires 'feedback:manage', or having written it.
   */
  export type delete_DeleteFeedbackComment = {
    method: "DELETE";
    path: "/api/feedback/{id}/comments/{commentId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string; commentId: string };
    };
    responses: {
      200: Schemas.FeedbackMessageResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Create a new base form template. Requires 'forms:create' permission.
   */
  export type post_CreateForm = {
    method: "POST";
    path: "/api/forms";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateForm;
    };
    responses: {
      201: Schemas.FormResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * List all form templates by default. Use ?all=true to include all forms. Returns template forms by default.
   */
  export type get_ListForms = {
    method: "GET";
    path: "/api/forms";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.FormList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Get a form by ID with all fields and options
   */
  export type get_GetForm = {
    method: "GET";
    path: "/api/forms/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: { 200: Schemas.FormDetail; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Update a form. Requires permission to manage the form.
   */
  export type patch_UpdateForm = {
    method: "PATCH";
    path: "/api/forms/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateForm;
    };
    responses: {
      200: Schemas.UpdateFormResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a form and all associated data. Requires permission to manage the form.
   */
  export type delete_DeleteForm = {
    method: "DELETE";
    path: "/api/forms/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteFormResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Get aggregated statistics for a form. Requires permission to manage the form.
   */
  export type get_GetFormStatistics = {
    method: "GET";
    path: "/api/forms/{id}/statistics";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.FormStatistics;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Submit answers to a form
   */
  export type post_CreateFormSubmission = {
    method: "POST";
    path: "/api/forms/{formId}/submissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string };

      body: Schemas.CreateSubmission;
    };
    responses: {
      201: Schemas.CreateSubmissionResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * List all submissions for a form. Requires permission to manage the form.
   */
  export type get_ListFormSubmissions = {
    method: "GET";
    path: "/api/forms/{formId}/submissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string };
    };
    responses: {
      200: Schemas.SubmissionList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete all submissions for a form. Requires permission to manage the form.
   */
  export type delete_DeleteAllFormSubmissions = {
    method: "DELETE";
    path: "/api/forms/{formId}/submissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string };
    };
    responses: {
      200: Schemas.DeleteSubmissionResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Download all submissions for a form as CSV. Requires permission to manage the form.
   */
  export type get_DownloadFormSubmissions = {
    method: "GET";
    path: "/api/forms/{formId}/submissions/download";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string };
    };
    responses: { 200: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * List the authenticated user's own submissions for a form, newest first. Available to any authenticated user; no form management permission needed.
   */
  export type get_ListOwnFormSubmissions = {
    method: "GET";
    path: "/api/forms/{formId}/submissions/me";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string };
    };
    responses: {
      200: Schemas.SubmissionList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Get a specific submission. Can view own submission or requires permission to manage the form.
   */
  export type get_GetFormSubmission = {
    method: "GET";
    path: "/api/forms/{formId}/submissions/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string; id: string };
    };
    responses: {
      200: Schemas.SubmissionDetail;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a submission and notify the user with a reason. Requires permission to manage the form.
   */
  export type delete_DeleteFormSubmission = {
    method: "DELETE";
    path: "/api/forms/{formId}/submissions/{id}/destroy_with_reason";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { formId: string; id: string };

      body: Schemas.DeleteSubmissionWithReason;
    };
    responses: {
      200: Schemas.DeleteSubmissionResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Create a new photo album. Requires 'galleries:create' permission.
   */
  export type post_CreateGallery = {
    method: "POST";
    path: "/api/galleries";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateGallery;
    };
    responses: {
      201: Schemas.Gallery;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Get a paginated list of photo albums, newest first. Members only.
   */
  export type get_ListGalleries = {
    method: "GET";
    path: "/api/galleries";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; search: string }>;
    };
    responses: {
      200: Schemas.GalleryList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Get a paginated list of the pictures in an album. This is what backs the 'Last inn mer' button. Members only.
   */
  export type get_ListGalleryPictures = {
    method: "GET";
    path: "/api/galleries/{slug}/pictures";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number }>;
      path: { slug: string };
    };
    responses: {
      200: Schemas.GalleryPictureList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Add one or more already-uploaded images to an album. Upload the files via POST /api/assets first, then send the resulting URLs here. Requires 'galleries:pictures:create' or 'galleries:manage' permission.
   */
  export type post_CreateGalleryPictures = {
    method: "POST";
    path: "/api/galleries/{slug}/pictures";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };

      body: Schemas.CreateGalleryPictures;
    };
    responses: {
      201: Schemas.CreateGalleryPicturesResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Update the title, description or alt text of a picture. Requires 'galleries:pictures:update' or 'galleries:manage' permission.
   */
  export type patch_UpdateGalleryPicture = {
    method: "PATCH";
    path: "/api/galleries/{slug}/pictures/{pictureId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string; pictureId: string };

      body: Schemas.UpdateGalleryPicture;
    };
    responses: {
      200: Schemas.GalleryPicture;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Remove a single picture from an album. Requires 'galleries:pictures:delete' or 'galleries:manage' permission.
   */
  export type delete_DeleteGalleryPicture = {
    method: "DELETE";
    path: "/api/galleries/{slug}/pictures/{pictureId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string; pictureId: string };
    };
    responses: {
      200: Schemas.DeleteGalleryPictureResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Get a single album by slug (or ID). Pictures are fetched separately via /api/galleries/{slug}/pictures. Members only.
   */
  export type get_GetGallery = {
    method: "GET";
    path: "/api/galleries/{slug}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };
    };
    responses: { 200: Schemas.Gallery; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Update an album. Requires 'galleries:update' or 'galleries:manage' permission, or being the creator. The slug is not regenerated on rename, so existing links keep working.
   */
  export type patch_UpdateGallery = {
    method: "PATCH";
    path: "/api/galleries/{slug}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };

      body: Schemas.UpdateGallery;
    };
    responses: {
      200: Schemas.Gallery;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete an album and every picture in it. Requires 'galleries:delete' or 'galleries:manage' permission, or being the creator.
   */
  export type delete_DeleteGallery = {
    method: "DELETE";
    path: "/api/galleries/{slug}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };
    };
    responses: {
      200: Schemas.DeleteGalleryResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Stores the Expo push token of the calling user's device. Registering a token that already exists moves it to the authenticated user, so a shared phone never keeps notifying its previous owner.
   */
  export type post_RegisterNotificationDevice = {
    method: "POST";
    path: "/api/notification/device";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.RegisterNotificationDevice;
    };
    responses: {
      200: Schemas.NotificationDeviceResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Removes the Expo push token, typically on logout. Deleting a token that is not registered is a no-op.
   */
  export type delete_UnregisterNotificationDevice = {
    method: "DELETE";
    path: "/api/notification/device";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.UnregisterNotificationDevice;
    };
    responses: {
      200: Schemas.NotificationDeviceResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Returns paginated list of notifications for the authenticated user, ordered by most recent first. Pass isRead=false to count unread ones: totalCount answers that without fetching the notifications themselves.
   */
  export type get_ListNotifications = {
    method: "GET";
    path: "/api/notification";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; isRead: boolean }>;
    };
    responses: {
      200: Schemas.NotificationList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Delete a notification by ID. User must be authenticated and own the notification.
   */
  export type delete_DeleteNotification = {
    method: "DELETE";
    path: "/api/notification/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteNotificationResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Mark every unread notification of the authenticated user as read. Returns how many notifications were updated.
   */
  export type patch_MarkAllNotificationsRead = {
    method: "PATCH";
    path: "/api/notification/read-all";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: {
      200: Schemas.MarkAllNotificationsReadResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Update the read status of a notification. User must be authenticated and own the notification.
   */
  export type patch_MarkNotificationRead = {
    method: "PATCH";
    path: "/api/notification/{id}/read";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.MarkNotificationRead;
    };
    responses: {
      200: Schemas.MarkReadResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Retrieve the active groups, or with `archived=true` the archived groups the caller may open. Supports optional filtering by type and search query.
   */
  export type get_ListGroups = {
    method: "GET";
    path: "/api/groups";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ search: string; type: string; archived: "true" | "false" }>;
    };
    responses: { 200: Schemas.GroupList; 400: { success: false; error: Array<unknown>; data: unknown } };
  };
  /**
   * Create a new group. Requires 'groups:create' permission.
   */
  export type post_CreateGroup = {
    method: "POST";
    path: "/api/groups";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateGroup;
    };
    responses: { 201: Schemas.Group; 400: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Retrieve all groups the authenticated user is a member of, including membership info.
   */
  export type get_ListMyGroups = {
    method: "GET";
    path: "/api/groups/mine";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.MyGroupList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Archive a group. It leaves the group list, only its members can open it, nothing in it can be changed and it grants no permissions — but nothing is deleted, and unarchiving brings it all back. Requires being the group's leader OR holding 'groups:manage'.
   */
  export type post_ArchiveGroup = {
    method: "POST";
    path: "/api/groups/{slug}/archive";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };
    };
    responses: {
      200: Schemas.UpdateGroupResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Bring an archived group back: it returns to the group list, becomes editable again, and its members, leader and verv regain the permissions the group grants. Requires being the group's leader OR holding 'groups:manage'.
   */
  export type post_UnarchiveGroup = {
    method: "POST";
    path: "/api/groups/{slug}/unarchive";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };
    };
    responses: {
      200: Schemas.UpdateGroupResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Partially update an existing group by its slug. Only provided fields will be updated. Requires being a group leader OR having 'groups:update' permission (globally or scoped to this group).
   */
  export type patch_UpdateGroup = {
    method: "PATCH";
    path: "/api/groups/{slug}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };

      body: Schemas.UpdateGroup;
    };
    responses: {
      200: Schemas.UpdateGroupResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a group by its slug. Requires being the group's leader OR holding 'groups:delete' for all of TIHLDE, and repeating the slug in `confirm`. This action is irreversible and will remove all associated data, including memberships, fines, laws, forms and verv.
   */
  export type delete_DeleteGroup = {
    method: "DELETE";
    path: "/api/groups/{slug}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { confirm: string };
      path: { slug: string };
    };
    responses: {
      204: unknown;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Retrieve detailed information about a specific group by its slug identifier.
   */
  export type get_GetGroup = {
    method: "GET";
    path: "/api/groups/{slug}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };
    };
    responses: { 200: Schemas.GroupDetail; 403: unknown; 404: unknown };
  };
  /**
   * Retrieve a paginated list of fines for a group, newest first. Group members can view all fines in their own group (Lepton parity), as can the fines admin and root. A former member sees only the fines they are party to: the ones they received and the ones they handed out. Anyone who never belonged to the group is refused. Filter with 'status' and 'userId'.
   */
  export type get_ListFines = {
    method: "GET";
    path: "/api/groups/{groupSlug}/fines";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        pageSize: number;
        page: number;
        status: "pending" | "approved" | "paid" | "rejected";
        userId: string;
      }>;
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.FineList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Create a new fine for a group member. Requires being a member of the group (bøter follow membership, not permissions). Root may fine across groups.
   */
  export type post_CreateFine = {
    method: "POST";
    path: "/api/groups/{groupSlug}/fines";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.CreateFine;
    };
    responses: {
      201: Schemas.Fine;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Sum of fine amounts per settlement stage for a group: awaiting approval, approved but unpaid, and paid. Rejected fines are excluded. The unpaid totals only count the group's current members — a fine follows the person out of the group, but the debt does not. 'paid' is history and counts everyone. Same audience as the fine list.
   */
  export type get_GetFineStatistics = {
    method: "GET";
    path: "/api/groups/{groupSlug}/fines/statistics";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.FineStatistics;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Paginated list of the group's members with the sum of their active fine amounts, highest first. Active means not settled: fines awaiting approval and approved but unpaid ones. Paid and rejected fines are left out unless 'status' asks for them. Members without active fines are included with a total of 0.
   */
  export type get_ListFineUsers = {
    method: "GET";
    path: "/api/groups/{groupSlug}/fines/users";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; status: "pending" | "approved" | "paid" | "rejected" }>;
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.FineUserList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Set the same status on a list of fines. Every fine must belong to the group in the path. Requires being the fines admin (botsjef) or the group's leader.
   */
  export type patch_BatchUpdateFines = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/fines/batch";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.BatchUpdateFines;
    };
    responses: {
      200: Schemas.BatchUpdateFinesResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Set the same status on every fine the member has in this group, regardless of any filter the caller is currently looking at (Lepton parity). Requires being the fines admin (botsjef) or the group's leader.
   */
  export type patch_BatchUpdateUserFines = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/fines/users/{userId}/batch";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; userId: string };

      body: Schemas.BatchUpdateUserFines;
    };
    responses: {
      200: Schemas.BatchUpdateFinesResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Streams the picture attached to a fine.
   *
   * Fine pictures are private assets: `GET /api/assets/:key` refuses to serve
   * them, and this route is the only way to read one. The rule is the same one
   * that governs the fine itself — the member it was given to, the member who gave
   * it, any member of the group, the botsjef, and root.
   *
   * Anything else answers 404, signed-out callers included, so the route never
   * confirms that a given fine or picture exists.
   */
  export type get_GetFineImage = {
    method: "GET";
    path: "/api/groups/{groupSlug}/fines/{fineId}/image";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; fineId: string };
    };
    responses: { 200: unknown; 404: unknown };
  };
  /**
   * Retrieve detailed information about a specific fine. Group members can view every fine in their own group, and the fines admin and root can view any. Anyone party to a fine — the member who received it and the one who handed it out — can always view it, membership or not.
   */
  export type get_GetFine = {
    method: "GET";
    path: "/api/groups/{groupSlug}/fines/{fineId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; fineId: string };
    };
    responses: { 200: Schemas.Fine; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Partially update a fine. Only provided fields will be updated. Current members can add a defense to their own fines; someone who has left the group can read their fines but no longer write to them. Fines admins (botsjef) and group leaders can update status, approve/reject fines, and edit the reason, amount, paragraph and picture.
   */
  export type patch_UpdateFine = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/fines/{fineId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; fineId: string };

      body: Schemas.UpdateFine;
    };
    responses: {
      200: Schemas.UpdateFineResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a fine by its ID. Requires being the fines admin (botsjef) or the group's leader. This action is irreversible.
   */
  export type delete_DeleteFine = {
    method: "DELETE";
    path: "/api/groups/{groupSlug}/fines/{fineId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; fineId: string };
    };
    responses: { 204: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Retrieve the fine laws for a group, ordered by paragraph. Group members can view their own group's laws (Lepton parity), as can the fines admin and root.
   */
  export type get_ListLaws = {
    method: "GET";
    path: "/api/groups/{groupSlug}/laws";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: { 200: Schemas.LawList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Add a paragraph to a group's lovverk. Requires being the group's fines admin (botsjef) or a group leader.
   */
  export type post_CreateLaw = {
    method: "POST";
    path: "/api/groups/{groupSlug}/laws";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.CreateLaw;
    };
    responses: {
      201: Schemas.Law;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Update a paragraph in a group's lovverk. Requires being the group's fines admin (botsjef) or a group leader.
   */
  export type patch_UpdateLaw = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/laws/{lawId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; lawId: string };

      body: Schemas.UpdateLaw;
    };
    responses: {
      200: Schemas.Law;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a paragraph from a group's lovverk. Requires being the group's fines admin (botsjef) or a group leader.
   */
  export type delete_DeleteLaw = {
    method: "DELETE";
    path: "/api/groups/{groupSlug}/laws/{lawId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; lawId: string };
    };
    responses: { 204: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Retrieve the group's ended memberships — the people who used to be members. Anyone currently in the group is excluded, and a member with several stints is listed once, by their most recent one.
   */
  export type get_ListGroupFormerMembers = {
    method: "GET";
    path: "/api/groups/{groupSlug}/members/history";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: { 200: Schemas.GroupFormerMemberList; 403: unknown; 404: unknown };
  };
  /**
   * Retrieve a list of all members in a group.
   */
  export type get_ListGroupMembers = {
    method: "GET";
    path: "/api/groups/{groupSlug}/members";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: { 200: Schemas.GroupMemberList; 403: unknown; 404: unknown };
  };
  /**
   * Add a member to a group. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader.
   */
  export type post_AddGroupMember = {
    method: "POST";
    path: "/api/groups/{groupSlug}/members";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.AddGroupMember;
    };
    responses: {
      201: Schemas.GroupMembership;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Update a member's role in a group. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader — a sitting leader may only hand the leadership over to someone else.
   */
  export type patch_UpdateGroupMemberRole = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/members/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; userId: string };

      body: Schemas.UpdateGroupMemberRole;
    };
    responses: {
      200: Schemas.UpdateMemberRoleResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Remove a member from a group. Requires 'groups:manage' (globally or scoped to the group), or being the group's leader.
   */
  export type delete_RemoveGroupMember = {
    method: "DELETE";
    path: "/api/groups/{groupSlug}/members/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; userId: string };
    };
    responses: { 204: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Retrieve all positions (verv) for a group, with their holders.
   */
  export type get_ListGroupPositions = {
    method: "GET";
    path: "/api/groups/{groupSlug}/positions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.GroupPositionList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Create a new position (verv) in a group. Group leaders can create group-scoped positions limited to permissions they themselves hold in the group. Positions with global scope require the global 'roles:create' permission, and the creator must hold every granted permission globally.
   */
  export type post_CreateGroupPosition = {
    method: "POST";
    path: "/api/groups/{groupSlug}/positions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.CreateGroupPosition;
    };
    responses: {
      201: Schemas.GroupPosition;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Update a position's name, description, permissions or scope. The same guardrails as creation apply — including for the position's EXISTING scope, so a group leader cannot edit a global position, and permission changes are limited to permissions the editor holds.
   */
  export type patch_UpdateGroupPosition = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/positions/{positionId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; positionId: string };

      body: Schemas.UpdateGroupPosition;
    };
    responses: {
      200: Schemas.GroupPosition;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a position (verv). Holders lose the position's permissions. Deleting an HS position also takes the holder's seat in HS unless something else warrants it. Deleting a global position requires 'roles:create'.
   */
  export type delete_DeleteGroupPosition = {
    method: "DELETE";
    path: "/api/groups/{groupSlug}/positions/{positionId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; positionId: string };
    };
    responses: {
      200: Schemas.GroupPositionMessage;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Assign a position (verv) to a group member. A position may be held by several people at once, and assigning someone who already holds it is a no-op. The assigner must be able to manage the position AND hold all its permissions — you cannot hand out a title you could not have created (prevents e.g. assigning the root title without holding root).
   */
  export type post_AssignGroupPosition = {
    method: "POST";
    path: "/api/groups/{groupSlug}/positions/{positionId}/holders";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; positionId: string };

      body: Schemas.AssignGroupPosition;
    };
    responses: {
      200: Schemas.GroupPositionMessage;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * Remove a position (verv) from a holder. Same authorization as assigning.
   */
  export type delete_UnassignGroupPosition = {
    method: "DELETE";
    path: "/api/groups/{groupSlug}/positions/{positionId}/holders/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; positionId: string; userId: string };
    };
    responses: {
      200: Schemas.GroupPositionMessage;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
    };
  };
  /**
   * The permissions held by whoever currently leads the group, scoped to that group. Requires the same rights as managing the group's verv.
   */
  export type get_GetGroupLeaderPermissions = {
    method: "GET";
    path: "/api/groups/{groupSlug}/leader-permissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.GroupLeaderPermissions;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Replace the permissions held by the group's leader. Granted scoped to this group, so they never reach another group's resources. Requires "Tilganger" (roles:create/groups:manage) for this group — the group's own leader may not edit their own access. You can only grant permissions you hold yourself for this group.
   */
  export type patch_UpdateGroupLeaderPermissions = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/leader-permissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.UpdateGroupLeaderPermissions;
    };
    responses: {
      200: Schemas.GroupLeaderPermissions;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * `permissions` is held by every member scoped to this group; `globalPermissions` is held by every member across all of TIHLDE. Requires the same rights as managing the group's verv.
   */
  export type get_GetGroupMemberPermissions = {
    method: "GET";
    path: "/api/groups/{groupSlug}/member-permissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.GroupMemberPermissions;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Replace both lists. `permissions` is granted scoped to this group; `globalPermissions` is granted across all of TIHLDE and therefore requires holding each of them globally yourself.
   */
  export type patch_UpdateGroupMemberPermissions = {
    method: "PATCH";
    path: "/api/groups/{groupSlug}/member-permissions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };

      body: Schemas.UpdateGroupMemberPermissions;
    };
    responses: {
      200: Schemas.GroupMemberPermissions;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Create a form for a group. Requires group leader permission or forms:create permission.
   */
  export type post_CreateGroupForm = {
    method: "POST";
    path: "/api/groups/{slug}/forms";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };

      body: Schemas.CreateGroupForm;
    };
    responses: {
      201: Schemas.CreateGroupFormResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Get all forms for a group, filtered by user permissions
   */
  export type get_ListGroupForms = {
    method: "GET";
    path: "/api/groups/{slug}/forms";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { slug: string };
    };
    responses: {
      200: Schemas.GroupFormList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * The NTNU institutes TIHLDE's study programmes run under. Used to pick which institute an event is reserved for. Reference data — public and unpaginated, since there are only ever a couple of them.
   */
  export type get_ListInstitutes = {
    method: "GET";
    path: "/api/institutes";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.InstituteList };
  };
  /**
   * Returns the currently active volunteer contract with a direct download URL for the PDF.
   */
  export type get_GetActiveContract = {
    method: "GET";
    path: "/api/contracts/active";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: {
      200: Schemas.ActiveContract;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Returns whether the authenticated user has signed the currently active contract.
   */
  export type get_GetMySignatureStatus = {
    method: "GET";
    path: "/api/contracts/my-signature";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.SignatureStatus; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Signs the active volunteer contract for the authenticated user.
   *
   * The signature PNG is stamped onto the contract at the placement chosen when the
   * contract was uploaded, and the resulting PDF is stored as the signed document.
   * Both the signature and the signed PDF are private assets — fetch the signed PDF
   * via GET /api/contracts/signed-pdf, never the public asset route.
   *
   * Sends email to notification contacts of all groups the user belongs to that
   * require contract signing.
   */
  export type post_SignContract = {
    method: "POST";
    path: "/api/contracts/sign";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.SignContract;
    };
    responses: {
      201: Schemas.SignContractResponse;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
      409: unknown;
      422: unknown;
    };
  };
  /**
   * Streams the authenticated user's signed copy of the active contract, with their signature stamped in.
   */
  export type get_GetMySignedContractPdf = {
    method: "GET";
    path: "/api/contracts/signed-pdf";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Streams a member's signed copy of the active contract. Requires 'contracts:manage' permission.
   */
  export type get_GetUserSignedContractPdf = {
    method: "GET";
    path: "/api/contracts/signed-pdf/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { userId: string };
    };
    responses: { 200: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Returns all contract versions newest first. Requires 'contracts:view' permission.
   */
  export type get_ListContracts = {
    method: "GET";
    path: "/api/contracts";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.ContractList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Registers a new contract version. Does not auto-activate. Upload the PDF via POST /api/assets first, then pass the returned fileKey here. Requires 'contracts:create' permission.
   */
  export type post_CreateContract = {
    method: "POST";
    path: "/api/contracts";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateContract;
    };
    responses: { 201: Schemas.Contract; 400: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Sets the specified contract as active; deactivates all others. Requires 'contracts:update' permission.
   */
  export type patch_ActivateContract = {
    method: "PATCH";
    path: "/api/contracts/{id}/activate";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.ActivateContractResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Returns all group members with their signing status for the active contract. Requires being a group leader or 'contracts:view' permission.
   */
  export type get_GetGroupContractSignatures = {
    method: "GET";
    path: "/api/contracts/groups/{groupSlug}/signatures";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string };
    };
    responses: {
      200: Schemas.GroupSignatureList;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Removes a member's signature from the active contract. Requires being a group leader or 'contracts:manage' permission.
   */
  export type delete_RevokeContractSignature = {
    method: "DELETE";
    path: "/api/contracts/groups/{groupSlug}/signatures/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { groupSlug: string; userId: string };
    };
    responses: {
      200: Schemas.RevokeSignatureResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Create a new news article. Requires 'news:create' or 'news:manage', held globally or for any single group.
   */
  export type post_CreateNews = {
    method: "POST";
    path: "/api/news";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateNews;
    };
    responses: {
      201: Schemas.NewsArticle;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Get a paginated list of news articles. Public endpoint; archived articles are left out unless the caller asks for them and holds 'news:create', 'news:update' or 'news:manage'.
   */
  export type get_ListNews = {
    method: "GET";
    path: "/api/news";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ pageSize: number; page: number; archived: "exclude" | "include" | "only" }>;
    };
    responses: { 200: Schemas.NewsList; 400: { success: false; error: Array<unknown>; data: unknown }; 403: unknown };
  };
  /**
   * Get a single news article by ID. Public endpoint. An archived article is only visible to callers holding 'news:create', 'news:update' or 'news:manage'.
   */
  export type get_GetNews = {
    method: "GET";
    path: "/api/news/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: { 200: Schemas.NewsArticle; 404: unknown };
  };
  /**
   * Update a news article, including archiving and restoring it via `archived`. Requires 'news:update' or 'news:manage', held globally or for any single group, or being the creator.
   */
  export type patch_UpdateNews = {
    method: "PATCH";
    path: "/api/news/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateNews;
    };
    responses: {
      200: Schemas.NewsArticle;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a news article. Requires 'news:delete' or 'news:manage', held globally or for any single group, or being the creator.
   */
  export type delete_DeleteNews = {
    method: "DELETE";
    path: "/api/news/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteNewsResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Add or update emoji reaction to a news article. Requires authentication.
   */
  export type post_CreateNewsReaction = {
    method: "POST";
    path: "/api/news/{id}/reactions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.CreateNewsReaction;
    };
    responses: {
      201: Schemas.NewsReaction;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Remove your emoji reaction from a news article.
   */
  export type delete_DeleteNewsReaction = {
    method: "DELETE";
    path: "/api/news/{id}/reactions";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteNewsReactionResponse;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Every issue of the student magazine, newest first. Public endpoint. The archive is small and rarely changes, so it is returned unpaginated.
   */
  export type get_ListToddel = {
    method: "GET";
    path: "/api/toddel";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.ToddelList };
  };
  /**
   * Add an issue to the archive. Upload the PDF (and the cover, if there is one) via POST /api/assets first, then pass the returned keys here. Requires 'toddel:create' or 'toddel:manage', held globally or for any single group.
   */
  export type post_CreateToddel = {
    method: "POST";
    path: "/api/toddel";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateToddel;
    };
    responses: {
      201: Schemas.ToddelIssue;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      409: unknown;
    };
  };
  /**
   * Change the title, date or files of a published issue. Pass a new asset key to replace a file; leaving it out keeps the current one. Requires 'toddel:update' or 'toddel:manage', held globally or for any single group.
   */
  export type patch_UpdateToddel = {
    method: "PATCH";
    path: "/api/toddel/{edition}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { edition: string };

      body: Schemas.UpdateToddel;
    };
    responses: {
      200: Schemas.ToddelIssue;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Take an issue out of the archive. The uploaded files are left in storage — a wrongly deleted issue can then be restored by re-creating it with the same keys. Requires 'toddel:delete' or 'toddel:manage', held globally or for any single group.
   */
  export type delete_DeleteToddel = {
    method: "DELETE";
    path: "/api/toddel/{edition}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { edition: string };
    };
    responses: {
      200: Schemas.DeleteToddelResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * List all RBAC roles with their permissions and assigned users, ordered by hierarchy position (highest first).
   */
  export type get_ListRoles = {
    method: "GET";
    path: "/api/roles";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.RoleList; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Create a new RBAC role. The role is positioned directly below the creator's highest role. The creator can only grant permissions they hold themselves.
   */
  export type post_CreateRole = {
    method: "POST";
    path: "/api/roles";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateRole;
    };
    responses: { 201: Schemas.Role; 400: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Update a role's name, description or permissions. Hierarchy applies: you can only edit roles strictly below your own highest role, and only grant permissions you hold yourself.
   */
  export type patch_UpdateRole = {
    method: "PATCH";
    path: "/api/roles/{roleId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { roleId: string };

      body: Schemas.UpdateRole;
    };
    responses: {
      200: Schemas.Role;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a role. Hierarchy applies: you can only delete roles strictly below your own highest role. Assignments are removed with it.
   */
  export type delete_DeleteRole = {
    method: "DELETE";
    path: "/api/roles/{roleId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { roleId: string };
    };
    responses: { 200: Schemas.RoleMessage; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Assign a role to a user. Hierarchy applies: you can only assign roles strictly below your own highest role.
   */
  export type post_AssignRole = {
    method: "POST";
    path: "/api/roles/{roleId}/users";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { roleId: string };

      body: Schemas.AssignRole;
    };
    responses: {
      200: Schemas.RoleMessage;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Remove a role from a user. Hierarchy applies: you can only remove roles strictly below your own highest role.
   */
  export type delete_UnassignRole = {
    method: "DELETE";
    path: "/api/roles/{roleId}/users/{userId}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { roleId: string; userId: string };
    };
    responses: { 200: Schemas.RoleMessage; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Create a new job posting. Requires 'jobs:create' or 'jobs:manage', held globally or for any single group.
   */
  export type post_CreateJob = {
    method: "POST";
    path: "/api/jobs";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.CreateJob;
    };
    responses: { 201: Schemas.JobDetail; 400: unknown; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Get a paginated list of job postings. Supports search, job type, single or multiple years of study, and expired filtering. Public endpoint.
   */
  export type get_ListJobs = {
    method: "GET";
    path: "/api/jobs";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        pageSize: number;
        page: number;
        search: string;
        expired: boolean;
        jobType: "full_time" | "part_time" | "summer_job" | "other";
        years: Array<"first" | "second" | "third" | "fourth" | "fifth" | "alumni">;
        year: "first" | "second" | "third" | "fourth" | "fifth" | "alumni";
      }>;
    };
    responses: { 200: Schemas.JobList; 400: { success: false; error: Array<unknown>; data: unknown } };
  };
  /**
   * Get a single job posting by ID. Public endpoint.
   */
  export type get_GetJob = {
    method: "GET";
    path: "/api/jobs/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: { 200: Schemas.JobDetail; 404: unknown };
  };
  /**
   * Update a job posting. Requires 'jobs:update' or 'jobs:manage', held globally or for any single group, or being the creator.
   */
  export type patch_UpdateJob = {
    method: "PATCH";
    path: "/api/jobs/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateJob;
    };
    responses: {
      200: Schemas.JobDetail;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Delete a job posting. Requires 'jobs:delete' or 'jobs:manage', held globally or for any single group, or being the creator.
   */
  export type delete_DeleteJob = {
    method: "DELETE";
    path: "/api/jobs/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.DeleteJobResponse;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Retrieve the personal iCalendar subscription URL for the authenticated user's event registrations. The URL is created on first request.
   */
  export type get_GetCalendarSubscription = {
    method: "GET";
    path: "/api/user/me/calendar";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.CalendarSubscription; 401: Schemas.HTTPAppException };
  };
  /**
   * Issue a new personal iCalendar subscription URL. The previous URL stops working immediately.
   */
  export type post_RegenerateCalendarSubscription = {
    method: "POST";
    path: "/api/user/me/calendar/regenerate";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.CalendarSubscription; 401: Schemas.HTTPAppException };
  };
  /**
   * Retrieve the authenticated user's settings including preferences and allergies.
   */
  export type get_GetUserSettings = {
    method: "GET";
    path: "/api/user/me/settings";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.UserSettings; 401: Schemas.HTTPAppException; 404: unknown };
  };
  /**
   * Create initial user settings and mark the user as onboarded. Can only be called once per user.
   */
  export type post_OnboardUser = {
    method: "POST";
    path: "/api/user/me/settings";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.OnboardUserInput;
    };
    responses: { 201: Schemas.UserSettingsBase; 400: unknown; 401: Schemas.HTTPAppException };
  };
  /**
   * Partially update the authenticated user's settings. Only provided fields will be updated. Settings are created on first update for users who have not onboarded, so a member can accept the event rules without filling in a full profile.
   */
  export type patch_UpdateUserSettings = {
    method: "PATCH";
    path: "/api/user/me/settings";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.UpdateUserSettingsInput;
    };
    responses: { 200: Schemas.UpdateUserSettings; 400: unknown; 401: Schemas.HTTPAppException };
  };
  /**
   * Adds a username/password login to the authenticated user, for accounts created through Feide. Refuses if the account already has a password — use the password reset flow to change an existing one.
   */
  export type post_SetPassword = {
    method: "POST";
    path: "/api/user/me/password";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.SetPasswordInput;
    };
    responses: { 200: Schemas.SetPasswordResponse; 400: unknown; 401: Schemas.HTTPAppException; 409: unknown };
  };
  /**
   * Evaluation forms for events the member attended but never answered. These block registration for new events.
   */
  export type get_ListUnansweredEvaluations = {
    method: "GET";
    path: "/api/user/me/unanswered-evaluations";
    requestFormat: "json";
    responseFormat: "json";
    parameters: never;
    responses: { 200: Schemas.UnansweredEvaluations; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException };
  };
  /**
   * Retrieve a list of all possible allergies that users can have. Pass `curated=true` to get only the maintained list suitable for a picker.
   */
  export type get_ListAllergies = {
    method: "GET";
    path: "/api/user/allergy";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{ curated: string }>;
    };
    responses: { 200: Schemas.AllergyList; 400: { success: false; error: Array<unknown>; data: unknown } };
  };
  /**
   * Creates an account the same way the website's sign-up does — verification mail sent — and enrols the member in a study programme. The username is derived from the @stud.ntnu.no address, unless the caller names one, which also lifts the requirement that the address be a stud one. Requires an API key with 'users:create'.
   */
  export type post_RegisterUser = {
    method: "POST";
    path: "/api/user/register";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      body: Schemas.RegisterUserInput;
    };
    responses: { 201: Schemas.RegisterUser; 400: unknown; 401: Schemas.HTTPAppException; 403: unknown; 409: unknown };
  };
  /**
   * Search users by name or username (case-insensitive substring). Used by admin UIs to assign roles and positions, and to name individually prioritized users on an event. Requires 'users:view' or 'roles:assign', or an event permission ('events:create'/'events:update'/'events:manage') held for at least one group — or, when 'groupSlug' is given, the right to manage that group's roster ('groups:manage' scoped to it, or being its leader).
   */
  export type get_SearchUsers = {
    method: "GET";
    path: "/api/user/search";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query: { q: string; groupSlug?: string };
    };
    responses: {
      200: Schemas.UserSearchResult;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Paginated list of every user, with optional name/username search and study filters. Used by the admin user overview. Requires 'users:view'.
   */
  export type get_ListUsers = {
    method: "GET";
    path: "/api/user";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      query?: Partial<{
        pageSize: number;
        page: number;
        search: string;
        study: string;
        studyStartYear: number;
        approvalStatus: "pending" | "approved";
      }>;
    };
    responses: {
      200: Schemas.UserList;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
    };
  };
  /**
   * Set a member's cohort start year by hand, overriding what Feide reports. Moves their STUDYYEAR group to match. Requires 'users:manage'.
   */
  export type patch_UpdateUserStudyYear = {
    method: "PATCH";
    path: "/api/user/{id}/study-year";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateStudyYearInput;
    };
    responses: {
      200: Schemas.UpdateStudyYear;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Move a member to another STUDY group, replacing the one they have. Null removes it. Requires 'users:manage'.
   */
  export type patch_UpdateUserStudy = {
    method: "PATCH";
    path: "/api/user/{id}/study";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateStudyInput;
    };
    responses: {
      200: Schemas.UpdateStudy;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * The allergies registered on one member. Requires 'users:manage'.
   */
  export type get_GetUserAllergies = {
    method: "GET";
    path: "/api/user/{id}/allergies";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      200: Schemas.UserAllergies;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Replace the allergies registered on one member. Requires 'users:manage'.
   */
  export type put_UpdateUserAllergies = {
    method: "PUT";
    path: "/api/user/{id}/allergies";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateUserAllergiesInput;
    };
    responses: {
      200: Schemas.UserAllergies;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Deactivating blocks sign-in and ends the member's sessions; the account and its history are kept. Requires 'users:manage'.
   */
  export type patch_UpdateUserStatus = {
    method: "PATCH";
    path: "/api/user/{id}/status";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateUserStatusInput;
    };
    responses: {
      200: Schemas.UpdateUserStatus;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Moves the account between 'member' and 'alumni'. Only 'member' may register for events; alumni keep every other kind of access. Setting one removes the other. Requires 'users:manage'.
   */
  export type patch_UpdateUserBaselineRole = {
    method: "PATCH";
    path: "/api/user/{id}/baseline-role";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.UpdateUserBaselineRoleInput;
    };
    responses: {
      200: Schemas.UpdateUserBaselineRole;
      400: { success: false; error: Array<unknown>; data: unknown };
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Grants a baseline role to an account that signed itself up on the website and is waiting for approval, and tells the person by e-mail. Defaults to 'member'; pass 'alumni' for a former member, who then keeps every kind of access except registering for events. Requires 'users:manage'.
   */
  export type post_ApproveUser = {
    method: "POST";
    path: "/api/user/{id}/approve";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };

      body: Schemas.ApproveUserInput;
    };
    responses: {
      200: Schemas.ApproveUser;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Irreversibly deletes the account along with its registrations, payments, fines, memberships and history. Prefer 'PATCH /user/{id}/status' to deactivate instead. Requires 'users:delete'.
   */
  export type delete_DeleteUser = {
    method: "DELETE";
    path: "/api/user/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: {
      204: unknown;
      400: unknown;
      401: Schemas.HTTPAppException;
      403: Schemas.HTTPAppException;
      404: unknown;
    };
  };
  /**
   * Public profile of a single user: name, bio, links, study programme and group memberships. Requires being signed in.
   */
  export type get_GetUserProfile = {
    method: "GET";
    path: "/api/user/{id}";
    requestFormat: "json";
    responseFormat: "json";
    parameters: {
      path: { id: string };
    };
    responses: { 200: Schemas.UserProfile; 401: Schemas.HTTPAppException; 403: Schemas.HTTPAppException; 404: unknown };
  };

  // </Endpoints>
}

// <EndpointByMethod>
export type EndpointByMethod = {
  get: {
    "/api/version": Endpoints.get_GetVersion;
    "/api/api-keys": Endpoints.get_ListApiKeys;
    "/api/api-keys/{id}": Endpoints.get_GetApiKey;
    "/api/applications/options": Endpoints.get_GetApplicationOptions;
    "/api/applications/mine": Endpoints.get_ListMyApplications;
    "/api/applications": Endpoints.get_ListApplications;
    "/api/applications/{id}/pdf": Endpoints.get_GetApplicationPdf;
    "/api/applications/{id}/attachments/{assetKey}": Endpoints.get_GetApplicationAttachment;
    "/api/applications/{id}": Endpoints.get_GetApplication;
    "/api/assets/metadata/{key}": Endpoints.get_GetAssetMetadata;
    "/api/assets/{key}": Endpoints.get_DownloadAsset;
    "/api/banners/visible": Endpoints.get_ListVisibleBanners;
    "/api/banners": Endpoints.get_ListBanners;
    "/api/event/strikes/members": Endpoints.get_ListStrikesByMember;
    "/api/event/strikes": Endpoints.get_ListStrikes;
    "/api/event/my-registrations": Endpoints.get_GetMyEventHistory;
    "/api/event/my-upcoming-registrations": Endpoints.get_GetMyUpcomingEvents;
    "/api/event/calendar/{token}/events.ics": Endpoints.get_GetCalendarFeed;
    "/api/event/favorite": Endpoints.get_GetFavoriteEvents;
    "/api/event": Endpoints.get_ListEvents;
    "/api/event/{eventId}": Endpoints.get_GetEvent;
    "/api/event/{eventId}/registration": Endpoints.get_ListEventRegistrations;
    "/api/event/{eventId}/allergies": Endpoints.get_GetEventAllergies;
    "/api/event/{eventId}/messages": Endpoints.get_ListEventMessages;
    "/api/event/{eventId}/payments": Endpoints.get_ListEventPayments;
    "/api/event/{eventId}/forms": Endpoints.get_ListEventForms;
    "/api/event/{eventId}/forms/{type}": Endpoints.get_GetEventForm;
    "/api/feedback": Endpoints.get_ListFeedback;
    "/api/feedback/{id}": Endpoints.get_GetFeedback;
    "/api/feedback/{id}/comments": Endpoints.get_ListFeedbackComments;
    "/api/forms": Endpoints.get_ListForms;
    "/api/forms/{id}": Endpoints.get_GetForm;
    "/api/forms/{id}/statistics": Endpoints.get_GetFormStatistics;
    "/api/forms/{formId}/submissions": Endpoints.get_ListFormSubmissions;
    "/api/forms/{formId}/submissions/download": Endpoints.get_DownloadFormSubmissions;
    "/api/forms/{formId}/submissions/me": Endpoints.get_ListOwnFormSubmissions;
    "/api/forms/{formId}/submissions/{id}": Endpoints.get_GetFormSubmission;
    "/api/galleries": Endpoints.get_ListGalleries;
    "/api/galleries/{slug}/pictures": Endpoints.get_ListGalleryPictures;
    "/api/galleries/{slug}": Endpoints.get_GetGallery;
    "/api/notification": Endpoints.get_ListNotifications;
    "/api/groups": Endpoints.get_ListGroups;
    "/api/groups/mine": Endpoints.get_ListMyGroups;
    "/api/groups/{slug}": Endpoints.get_GetGroup;
    "/api/groups/{groupSlug}/fines": Endpoints.get_ListFines;
    "/api/groups/{groupSlug}/fines/statistics": Endpoints.get_GetFineStatistics;
    "/api/groups/{groupSlug}/fines/users": Endpoints.get_ListFineUsers;
    "/api/groups/{groupSlug}/fines/{fineId}/image": Endpoints.get_GetFineImage;
    "/api/groups/{groupSlug}/fines/{fineId}": Endpoints.get_GetFine;
    "/api/groups/{groupSlug}/laws": Endpoints.get_ListLaws;
    "/api/groups/{groupSlug}/members/history": Endpoints.get_ListGroupFormerMembers;
    "/api/groups/{groupSlug}/members": Endpoints.get_ListGroupMembers;
    "/api/groups/{groupSlug}/positions": Endpoints.get_ListGroupPositions;
    "/api/groups/{groupSlug}/leader-permissions": Endpoints.get_GetGroupLeaderPermissions;
    "/api/groups/{groupSlug}/member-permissions": Endpoints.get_GetGroupMemberPermissions;
    "/api/groups/{slug}/forms": Endpoints.get_ListGroupForms;
    "/api/institutes": Endpoints.get_ListInstitutes;
    "/api/contracts/active": Endpoints.get_GetActiveContract;
    "/api/contracts/my-signature": Endpoints.get_GetMySignatureStatus;
    "/api/contracts/signed-pdf": Endpoints.get_GetMySignedContractPdf;
    "/api/contracts/signed-pdf/{userId}": Endpoints.get_GetUserSignedContractPdf;
    "/api/contracts": Endpoints.get_ListContracts;
    "/api/contracts/groups/{groupSlug}/signatures": Endpoints.get_GetGroupContractSignatures;
    "/api/news": Endpoints.get_ListNews;
    "/api/news/{id}": Endpoints.get_GetNews;
    "/api/toddel": Endpoints.get_ListToddel;
    "/api/roles": Endpoints.get_ListRoles;
    "/api/jobs": Endpoints.get_ListJobs;
    "/api/jobs/{id}": Endpoints.get_GetJob;
    "/api/user/me/calendar": Endpoints.get_GetCalendarSubscription;
    "/api/user/me/settings": Endpoints.get_GetUserSettings;
    "/api/user/me/unanswered-evaluations": Endpoints.get_ListUnansweredEvaluations;
    "/api/user/allergy": Endpoints.get_ListAllergies;
    "/api/user/search": Endpoints.get_SearchUsers;
    "/api/user": Endpoints.get_ListUsers;
    "/api/user/{id}/allergies": Endpoints.get_GetUserAllergies;
    "/api/user/{id}": Endpoints.get_GetUserProfile;
  };
  post: {
    "/api/api-keys": Endpoints.post_CreateApiKey;
    "/api/api-keys/{id}/regenerate": Endpoints.post_RegenerateApiKey;
    "/api/api-keys/validate": Endpoints.post_ValidateApiKey;
    "/api/applications/expense": Endpoints.post_CreateExpenseApplication;
    "/api/applications/support": Endpoints.post_CreateSupportApplication;
    "/api/applications/sports-support": Endpoints.post_CreateSportsSupportApplication;
    "/api/applications/hs-case": Endpoints.post_CreateHsCaseApplication;
    "/api/applications/{id}/pdf/regenerate": Endpoints.post_RegenerateApplicationPdf;
    "/api/assets": Endpoints.post_UploadAsset;
    "/api/assets/promote/{key}": Endpoints.post_PromoteAsset;
    "/api/banners": Endpoints.post_CreateBanner;
    "/api/account-link/help": Endpoints.post_RequestAccountLinkHelp;
    "/api/account-link/sync": Endpoints.post_SyncFeideAccount;
    "/api/company/contact": Endpoints.post_SubmitCompanyContact;
    "/api/email/send": Endpoints.post_SendCustomEmail;
    "/api/event/strikes": Endpoints.post_CreateStrike;
    "/api/event": Endpoints.post_CreateEvent;
    "/api/event/{eventId}/registration": Endpoints.post_CreateEventRegistration;
    "/api/event/{eventId}/registration/{userId}": Endpoints.post_AdminCreateEventRegistration;
    "/api/event/{eventId}/messages": Endpoints.post_SendEventMessage;
    "/api/event/{eventId}/messages/test": Endpoints.post_TestEventMessage;
    "/api/event/{eventId}/payment": Endpoints.post_CreateEventPayment;
    "/api/event/{eventId}/payment/confirm": Endpoints.post_ConfirmEventPayment;
    "/api/event/{eventId}/payments/{paymentId}/refund": Endpoints.post_RefundEventPayment;
    "/api/event/payment/webhook": Endpoints.post_HandlePaymentWebhook;
    "/api/event/{eventId}/forms": Endpoints.post_CreateEventForm;
    "/api/event/{eventId}/reactions": Endpoints.post_CreateEventReaction;
    "/api/feedback": Endpoints.post_CreateFeedback;
    "/api/feedback/{id}/comments": Endpoints.post_CreateFeedbackComment;
    "/api/forms": Endpoints.post_CreateForm;
    "/api/forms/{formId}/submissions": Endpoints.post_CreateFormSubmission;
    "/api/galleries": Endpoints.post_CreateGallery;
    "/api/galleries/{slug}/pictures": Endpoints.post_CreateGalleryPictures;
    "/api/notification/device": Endpoints.post_RegisterNotificationDevice;
    "/api/groups": Endpoints.post_CreateGroup;
    "/api/groups/{slug}/archive": Endpoints.post_ArchiveGroup;
    "/api/groups/{slug}/unarchive": Endpoints.post_UnarchiveGroup;
    "/api/groups/{groupSlug}/fines": Endpoints.post_CreateFine;
    "/api/groups/{groupSlug}/laws": Endpoints.post_CreateLaw;
    "/api/groups/{groupSlug}/members": Endpoints.post_AddGroupMember;
    "/api/groups/{groupSlug}/positions": Endpoints.post_CreateGroupPosition;
    "/api/groups/{groupSlug}/positions/{positionId}/holders": Endpoints.post_AssignGroupPosition;
    "/api/groups/{slug}/forms": Endpoints.post_CreateGroupForm;
    "/api/contracts/sign": Endpoints.post_SignContract;
    "/api/contracts": Endpoints.post_CreateContract;
    "/api/news": Endpoints.post_CreateNews;
    "/api/news/{id}/reactions": Endpoints.post_CreateNewsReaction;
    "/api/toddel": Endpoints.post_CreateToddel;
    "/api/roles": Endpoints.post_CreateRole;
    "/api/roles/{roleId}/users": Endpoints.post_AssignRole;
    "/api/jobs": Endpoints.post_CreateJob;
    "/api/user/me/calendar/regenerate": Endpoints.post_RegenerateCalendarSubscription;
    "/api/user/me/settings": Endpoints.post_OnboardUser;
    "/api/user/me/password": Endpoints.post_SetPassword;
    "/api/user/register": Endpoints.post_RegisterUser;
    "/api/user/{id}/approve": Endpoints.post_ApproveUser;
  };
  patch: {
    "/api/api-keys/{id}": Endpoints.patch_UpdateApiKey;
    "/api/applications/{id}/status": Endpoints.patch_UpdateApplicationStatus;
    "/api/banners/{id}": Endpoints.patch_UpdateBanner;
    "/api/event/{eventId}/registration/{userId}/attendance": Endpoints.patch_SetRegistrationAttendance;
    "/api/feedback/{id}": Endpoints.patch_UpdateFeedback;
    "/api/forms/{id}": Endpoints.patch_UpdateForm;
    "/api/galleries/{slug}/pictures/{pictureId}": Endpoints.patch_UpdateGalleryPicture;
    "/api/galleries/{slug}": Endpoints.patch_UpdateGallery;
    "/api/notification/read-all": Endpoints.patch_MarkAllNotificationsRead;
    "/api/notification/{id}/read": Endpoints.patch_MarkNotificationRead;
    "/api/groups/{slug}": Endpoints.patch_UpdateGroup;
    "/api/groups/{groupSlug}/fines/batch": Endpoints.patch_BatchUpdateFines;
    "/api/groups/{groupSlug}/fines/users/{userId}/batch": Endpoints.patch_BatchUpdateUserFines;
    "/api/groups/{groupSlug}/fines/{fineId}": Endpoints.patch_UpdateFine;
    "/api/groups/{groupSlug}/laws/{lawId}": Endpoints.patch_UpdateLaw;
    "/api/groups/{groupSlug}/members/{userId}": Endpoints.patch_UpdateGroupMemberRole;
    "/api/groups/{groupSlug}/positions/{positionId}": Endpoints.patch_UpdateGroupPosition;
    "/api/groups/{groupSlug}/leader-permissions": Endpoints.patch_UpdateGroupLeaderPermissions;
    "/api/groups/{groupSlug}/member-permissions": Endpoints.patch_UpdateGroupMemberPermissions;
    "/api/contracts/{id}/activate": Endpoints.patch_ActivateContract;
    "/api/news/{id}": Endpoints.patch_UpdateNews;
    "/api/toddel/{edition}": Endpoints.patch_UpdateToddel;
    "/api/roles/{roleId}": Endpoints.patch_UpdateRole;
    "/api/jobs/{id}": Endpoints.patch_UpdateJob;
    "/api/user/me/settings": Endpoints.patch_UpdateUserSettings;
    "/api/user/{id}/study-year": Endpoints.patch_UpdateUserStudyYear;
    "/api/user/{id}/study": Endpoints.patch_UpdateUserStudy;
    "/api/user/{id}/status": Endpoints.patch_UpdateUserStatus;
    "/api/user/{id}/baseline-role": Endpoints.patch_UpdateUserBaselineRole;
  };
  delete: {
    "/api/api-keys/{id}": Endpoints.delete_DeleteApiKey;
    "/api/banners/{id}": Endpoints.delete_DeleteBanner;
    "/api/event/strikes/{strikeId}": Endpoints.delete_DeleteStrike;
    "/api/event/{eventId}": Endpoints.delete_DeleteEvent;
    "/api/event/{eventId}/registration": Endpoints.delete_DeleteEventRegistration;
    "/api/event/{eventId}/reactions": Endpoints.delete_DeleteEventReaction;
    "/api/feedback/{id}": Endpoints.delete_DeleteFeedback;
    "/api/feedback/{id}/vote": Endpoints.delete_DeleteFeedbackVote;
    "/api/feedback/{id}/comments/{commentId}": Endpoints.delete_DeleteFeedbackComment;
    "/api/forms/{id}": Endpoints.delete_DeleteForm;
    "/api/forms/{formId}/submissions": Endpoints.delete_DeleteAllFormSubmissions;
    "/api/forms/{formId}/submissions/{id}/destroy_with_reason": Endpoints.delete_DeleteFormSubmission;
    "/api/galleries/{slug}/pictures/{pictureId}": Endpoints.delete_DeleteGalleryPicture;
    "/api/galleries/{slug}": Endpoints.delete_DeleteGallery;
    "/api/notification/device": Endpoints.delete_UnregisterNotificationDevice;
    "/api/notification/{id}": Endpoints.delete_DeleteNotification;
    "/api/groups/{slug}": Endpoints.delete_DeleteGroup;
    "/api/groups/{groupSlug}/fines/{fineId}": Endpoints.delete_DeleteFine;
    "/api/groups/{groupSlug}/laws/{lawId}": Endpoints.delete_DeleteLaw;
    "/api/groups/{groupSlug}/members/{userId}": Endpoints.delete_RemoveGroupMember;
    "/api/groups/{groupSlug}/positions/{positionId}": Endpoints.delete_DeleteGroupPosition;
    "/api/groups/{groupSlug}/positions/{positionId}/holders/{userId}": Endpoints.delete_UnassignGroupPosition;
    "/api/contracts/groups/{groupSlug}/signatures/{userId}": Endpoints.delete_RevokeContractSignature;
    "/api/news/{id}": Endpoints.delete_DeleteNews;
    "/api/news/{id}/reactions": Endpoints.delete_DeleteNewsReaction;
    "/api/toddel/{edition}": Endpoints.delete_DeleteToddel;
    "/api/roles/{roleId}": Endpoints.delete_DeleteRole;
    "/api/roles/{roleId}/users/{userId}": Endpoints.delete_UnassignRole;
    "/api/jobs/{id}": Endpoints.delete_DeleteJob;
    "/api/user/{id}": Endpoints.delete_DeleteUser;
  };
  put: {
    "/api/event/favorite/{id}": Endpoints.put_UpdateEventFavorite;
    "/api/event/{id}": Endpoints.put_UpdateEvent;
    "/api/feedback/{id}/vote": Endpoints.put_VoteFeedback;
    "/api/user/{id}/allergies": Endpoints.put_UpdateUserAllergies;
  };
};

// </EndpointByMethod>

// <EndpointByMethod.Shorthands>
export type GetEndpoints = EndpointByMethod["get"];
export type PostEndpoints = EndpointByMethod["post"];
export type PatchEndpoints = EndpointByMethod["patch"];
export type DeleteEndpoints = EndpointByMethod["delete"];
export type PutEndpoints = EndpointByMethod["put"];
// </EndpointByMethod.Shorthands>

// <ApiClientTypes>
export type EndpointParameters = {
  body?: unknown;
  query?: unknown;
  header?: unknown;
  path?: unknown;
  cookie?: unknown;
};

export type MutationMethod = "post" | "put" | "patch" | "delete";
export type Method = "get" | "head" | "options" | "trace" | MutationMethod;

export type RequestFormat = "json" | "form-data" | "form-url" | "binary" | "text";
export type ResponseFormat = "json" | "sse";
export type SecurityRequirements = readonly (readonly string[])[];

// <EndpointRequestFormats>
/** Non-json request body encodings; missing entries default to `"json"`. */
export const endpointRequestFormats = {
  post: {
    "/api/assets": "form-data",
  },
} as Partial<{ [M in keyof EndpointByMethod]: Partial<{ [P in keyof EndpointByMethod[M]]: RequestFormat }> }>;
// </EndpointRequestFormats>

// <EndpointParameterStyles>
export type ParameterSerialization = { style: string; explode: boolean; allowReserved: boolean };
export type EndpointParameterStyles = Partial<
  Record<"query" | "path" | "header" | "cookie", Record<string, ParameterSerialization>>
>;
/** OpenAPI parameter styles used by the built-in encoders. */
export const endpointParameterStyles = {
  get: {
    "/api/api-keys/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/applications/mine": {
      query: {
        type: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
        limit: { style: "form", explode: true, allowReserved: false },
        offset: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/applications": {
      query: {
        type: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
        limit: { style: "form", explode: true, allowReserved: false },
        offset: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/applications/{id}/pdf": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/applications/{id}/attachments/{assetKey}": {
      path: {
        id: { style: "simple", explode: false, allowReserved: false },
        assetKey: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/applications/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/assets/metadata/{key}": { path: { key: { style: "simple", explode: false, allowReserved: false } } },
    "/api/assets/{key}": { path: { key: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/strikes/members": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/event/strikes": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        userId: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/event/my-registrations": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/event/calendar/{token}/events.ics": {
      path: { token: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        search: { style: "form", explode: true, allowReserved: false },
        category: { style: "form", explode: true, allowReserved: false },
        expired: { style: "form", explode: true, allowReserved: false },
        openSignUp: { style: "form", explode: true, allowReserved: false },
        startFrom: { style: "form", explode: true, allowReserved: false },
        startBefore: { style: "form", explode: true, allowReserved: false },
        organizerGroupSlug: { style: "form", explode: true, allowReserved: false },
        ordering: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/event/{eventId}": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/registration": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
      },
      path: { eventId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event/{eventId}/allergies": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/messages": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/payments": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
      },
      path: { eventId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event/{eventId}/forms": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/forms/{type}": {
      path: {
        eventId: { style: "simple", explode: false, allowReserved: false },
        type: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/feedback": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        type: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
        search: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/feedback/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/feedback/{id}/comments": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{id}/statistics": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{formId}/submissions": { path: { formId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{formId}/submissions/download": {
      path: { formId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/forms/{formId}/submissions/me": {
      path: { formId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/forms/{formId}/submissions/{id}": {
      path: {
        formId: { style: "simple", explode: false, allowReserved: false },
        id: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/galleries": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        search: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/galleries/{slug}/pictures": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
      },
      path: { slug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/galleries/{slug}": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/notification": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        isRead: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/groups": {
      query: {
        search: { style: "form", explode: true, allowReserved: false },
        type: { style: "form", explode: true, allowReserved: false },
        archived: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/groups/{slug}": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{groupSlug}/fines": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
        userId: { style: "form", explode: true, allowReserved: false },
      },
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/fines/statistics": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/fines/users": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        status: { style: "form", explode: true, allowReserved: false },
      },
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/fines/{fineId}/image": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        fineId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/fines/{fineId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        fineId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/laws": { path: { groupSlug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{groupSlug}/members/history": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/members": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/positions": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/leader-permissions": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/member-permissions": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{slug}/forms": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/contracts/signed-pdf/{userId}": {
      path: { userId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/contracts/groups/{groupSlug}/signatures": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/news": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        archived: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/news/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/jobs": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        search: { style: "form", explode: true, allowReserved: false },
        expired: { style: "form", explode: true, allowReserved: false },
        jobType: { style: "form", explode: true, allowReserved: false },
        years: { style: "form", explode: true, allowReserved: false },
        year: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/jobs/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/allergy": { query: { curated: { style: "form", explode: true, allowReserved: false } } },
    "/api/user/search": {
      query: {
        q: { style: "form", explode: true, allowReserved: false },
        groupSlug: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/user": {
      query: {
        pageSize: { style: "form", explode: true, allowReserved: false },
        page: { style: "form", explode: true, allowReserved: false },
        search: { style: "form", explode: true, allowReserved: false },
        study: { style: "form", explode: true, allowReserved: false },
        studyStartYear: { style: "form", explode: true, allowReserved: false },
        approvalStatus: { style: "form", explode: true, allowReserved: false },
      },
    },
    "/api/user/{id}/allergies": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
  },
  patch: {
    "/api/api-keys/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/applications/{id}/status": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/banners/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/registration/{userId}/attendance": {
      path: {
        eventId: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/feedback/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/galleries/{slug}/pictures/{pictureId}": {
      path: {
        slug: { style: "simple", explode: false, allowReserved: false },
        pictureId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/galleries/{slug}": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/notification/{id}/read": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{slug}": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{groupSlug}/fines/batch": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/fines/users/{userId}/batch": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/fines/{fineId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        fineId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/laws/{lawId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        lawId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/members/{userId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/positions/{positionId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        positionId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/leader-permissions": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/member-permissions": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/contracts/{id}/activate": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/news/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/toddel/{edition}": { path: { edition: { style: "simple", explode: false, allowReserved: false } } },
    "/api/roles/{roleId}": { path: { roleId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/jobs/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}/study-year": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}/study": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}/status": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}/baseline-role": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
  },
  delete: {
    "/api/api-keys/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/banners/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/strikes/{strikeId}": { path: { strikeId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/registration": {
      path: { eventId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event/{eventId}/reactions": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/feedback/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/feedback/{id}/vote": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/feedback/{id}/comments/{commentId}": {
      path: {
        id: { style: "simple", explode: false, allowReserved: false },
        commentId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/forms/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{formId}/submissions": { path: { formId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{formId}/submissions/{id}/destroy_with_reason": {
      path: {
        formId: { style: "simple", explode: false, allowReserved: false },
        id: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/galleries/{slug}/pictures/{pictureId}": {
      path: {
        slug: { style: "simple", explode: false, allowReserved: false },
        pictureId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/galleries/{slug}": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/notification/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{slug}": {
      query: { confirm: { style: "form", explode: true, allowReserved: false } },
      path: { slug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/fines/{fineId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        fineId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/laws/{lawId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        lawId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/members/{userId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/positions/{positionId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        positionId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{groupSlug}/positions/{positionId}/holders/{userId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        positionId: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/contracts/groups/{groupSlug}/signatures/{userId}": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/news/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/news/{id}/reactions": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/toddel/{edition}": { path: { edition: { style: "simple", explode: false, allowReserved: false } } },
    "/api/roles/{roleId}": { path: { roleId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/roles/{roleId}/users/{userId}": {
      path: {
        roleId: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/jobs/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
  },
  post: {
    "/api/api-keys/{id}/regenerate": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/applications/{id}/pdf/regenerate": {
      path: { id: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/assets/promote/{key}": { path: { key: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/registration": {
      path: { eventId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event/{eventId}/registration/{userId}": {
      path: {
        eventId: { style: "simple", explode: false, allowReserved: false },
        userId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/event/{eventId}/messages": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/messages/test": {
      path: { eventId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event/{eventId}/payment": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/payment/confirm": {
      path: { eventId: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/event/{eventId}/payments/{paymentId}/refund": {
      path: {
        eventId: { style: "simple", explode: false, allowReserved: false },
        paymentId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/event/{eventId}/forms": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{eventId}/reactions": { path: { eventId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/feedback/{id}/comments": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/forms/{formId}/submissions": { path: { formId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/galleries/{slug}/pictures": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{slug}/archive": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{slug}/unarchive": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{groupSlug}/fines": { path: { groupSlug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{groupSlug}/laws": { path: { groupSlug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/groups/{groupSlug}/members": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/positions": {
      path: { groupSlug: { style: "simple", explode: false, allowReserved: false } },
    },
    "/api/groups/{groupSlug}/positions/{positionId}/holders": {
      path: {
        groupSlug: { style: "simple", explode: false, allowReserved: false },
        positionId: { style: "simple", explode: false, allowReserved: false },
      },
    },
    "/api/groups/{slug}/forms": { path: { slug: { style: "simple", explode: false, allowReserved: false } } },
    "/api/news/{id}/reactions": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/roles/{roleId}/users": { path: { roleId: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}/approve": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
  },
  put: {
    "/api/event/favorite/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/event/{id}": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/feedback/{id}/vote": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
    "/api/user/{id}/allergies": { path: { id: { style: "simple", explode: false, allowReserved: false } } },
  },
} as Partial<Record<string, Partial<Record<string, EndpointParameterStyles>>>>;
// </EndpointParameterStyles>

// <EndpointResponseFormats>
/** Non-json response body modes; missing entries default to `"json"`. SSE skips JSON parse + output validation. */
export const endpointResponseFormats = {} as Partial<{
  [M in keyof EndpointByMethod]: Partial<{ [P in keyof EndpointByMethod[M]]: ResponseFormat }>;
}>;
// </EndpointResponseFormats>

// <EndpointSecurityRequirements>
/** OpenAPI security requirements applied when an endpoint has no explicit entry. */
export const defaultSecurityRequirements = [] as SecurityRequirements;
/** Endpoint-specific security requirements that differ from the default. */
export const endpointSecurityRequirements = {} as Partial<{
  [M in keyof EndpointByMethod]: Partial<{ [P in keyof EndpointByMethod[M]]: SecurityRequirements }>;
}>;
// </EndpointSecurityRequirements>

export type DefaultEndpoint = {
  parameters?: EndpointParameters | undefined;
  responses?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
};

export type Endpoint<TConfig extends DefaultEndpoint = DefaultEndpoint> = {
  operationId: string;
  method: Method;
  path: string;
  requestFormat: RequestFormat;
  responseFormat: ResponseFormat;
  parameters?: TConfig["parameters"];
  meta: {
    alias: string;
    hasParameters: boolean;
    areParametersRequired: boolean;
  };
  responses?: TConfig["responses"];
  responseHeaders?: TConfig["responseHeaders"];
};

/**
 * Minimal response surface used by ApiClient — avoids depending on the DOM `Response`
 * global (helpful for Node without DOM lib). Structural typing accepts fetch Response.
 */
export interface FetcherResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
    getSetCookie?: () => string[];
  };
  /** Present on fetch Response; used for SSE / streaming bodies. */
  body?: ReadableStream<Uint8Array> | null;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  clone(): FetcherResponse;
}

export interface Fetcher {
  decodePathParams?: (path: string, pathParams: unknown, styles?: Record<string, ParameterSerialization>) => string;
  encodeSearchParams?: (
    searchParams: unknown,
    styles?: Record<string, ParameterSerialization>,
  ) => URLSearchParams | undefined;
  /** Merge cookie params into request headers (default: Cookie header). */
  encodeCookies?: (cookies: unknown, headers: Headers) => void;
  //
  fetch: (input: {
    method: Method;
    url: URL;
    urlSearchParams?: URLSearchParams | undefined;
    parameters?: EndpointParameters | undefined;
    path: string;
    /** How to encode `parameters.body` (from OpenAPI requestBody content type). */
    requestFormat: RequestFormat;
    /** OpenAPI parameter serialization metadata for the current endpoint. */
    parameterStyles?: EndpointParameterStyles;
    /** OpenAPI security requirements for this operation. Empty means no credentials are required. */
    security?: SecurityRequirements;
    overrides?: RequestInit;
    throwOnStatusError?: boolean;
  }) => Promise<FetcherResponse>;
  parseResponseData?: (response: FetcherResponse) => Promise<unknown>;
}

export const successStatusCodes = [
  200, 201, 202, 203, 204, 205, 206, 207, 208, 226, 300, 301, 302, 303, 304, 305, 306, 307, 308,
] as const;
export type SuccessStatusCode = (typeof successStatusCodes)[number];

export const errorStatusCodes = [
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 419, 420, 421, 422,
  423, 424, 425, 426, 427, 428, 429, 430, 431, 432, 433, 434, 435, 436, 437, 438, 439, 440, 441, 442, 443, 444, 445,
  446, 447, 448, 449, 450, 451, 452, 453, 454, 455, 456, 457, 458, 459, 460, 461, 462, 463, 464, 465, 466, 467, 468,
  469, 470, 471, 472, 473, 474, 475, 476, 477, 478, 479, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491,
  492, 493, 494, 495, 496, 497, 498, 499, 500, 501, 502, 503, 504, 505, 506, 507, 508, 509, 510, 511, 512, 513, 514,
  515, 516, 517, 518, 519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530, 531, 532, 533, 534, 535, 536, 537,
  538, 539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 554, 555, 556, 557, 558, 559, 560,
  561, 562, 563, 564, 565, 566, 567, 568, 569, 570, 571, 572, 573, 574, 575, 576, 577, 578, 579, 580, 581, 582, 583,
  584, 585, 586, 587, 588, 589, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599,
] as const;
export type ErrorStatusCode = (typeof errorStatusCodes)[number];

// Taken from https://github.com/unjs/fetchdts/blob/ec4eaeab5d287116171fc1efd61f4a1ad34e4609/src/fetch.ts#L3
export interface TypedHeaders<TypedHeaderValues = unknown> extends Omit<
  Headers,
  "append" | "delete" | "get" | "getSetCookie" | "has" | "set" | "forEach"
> {
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append) */
  append: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
    value: Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string,
  ) => void;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/delete) */
  delete: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(name: Name) => void;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/get) */
  get: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
  ) => (Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string) | null;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie) */
  getSetCookie: () => string[];
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/has) */
  has: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(name: Name) => boolean;
  /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set) */
  set: <Name extends Extract<keyof TypedHeaderValues, string> | (string & {})>(
    name: Name,
    value: Lowercase<Name> extends keyof TypedHeaderValues ? TypedHeaderValues[Lowercase<Name>] : string,
  ) => void;
  forEach: (
    callbackfn: (
      value: TypedHeaderValues[keyof TypedHeaderValues] | (string & {}),
      key: Extract<keyof TypedHeaderValues, string> | (string & {}),
      parent: TypedHeaders<TypedHeaderValues>,
    ) => void,
    thisArg?: unknown,
  ) => void;
}

/** @see https://developer.mozilla.org/en-US/docs/Web/API/Response */
export interface TypedSuccessResponse<TSuccess, TStatusCode, THeaders> extends Omit<
  FetcherResponse,
  "ok" | "status" | "json" | "headers"
> {
  ok: true;
  status: TStatusCode;
  headers: never extends THeaders ? FetcherResponse["headers"] : TypedHeaders<THeaders>;
  data: TSuccess;
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) */
  json: () => Promise<TSuccess>;
}

/** @see https://developer.mozilla.org/en-US/docs/Web/API/Response */
export interface TypedErrorResponse<TData, TStatusCode, THeaders> extends Omit<
  FetcherResponse,
  "ok" | "status" | "json" | "headers"
> {
  ok: false;
  status: TStatusCode;
  headers: never extends THeaders ? FetcherResponse["headers"] : TypedHeaders<THeaders>;
  data: TData;
  /** [MDN Reference](https://developer.mozilla.org/en-US/docs/Web/API/Response/json) */
  json: () => Promise<TData>;
}

type StatusCodeFromKey<TKey> = TKey extends `${infer TStatusCode extends number}`
  ? TStatusCode
  : TKey extends number
    ? TKey
    : never;

export type TypedApiResponse<TAllResponses = {}, THeaders = {}> = {
  [K in keyof TAllResponses]: StatusCodeFromKey<K> extends infer TStatusCode extends number
    ? TStatusCode extends SuccessStatusCode
      ? TypedSuccessResponse<TAllResponses[K], TStatusCode, K extends keyof THeaders ? THeaders[K] : never>
      : TypedErrorResponse<TAllResponses[K], TStatusCode, K extends keyof THeaders ? THeaders[K] : never>
    : never;
}[keyof TAllResponses];

export type InferSchemaValue<T> = T;
type InferSchemaInput<T> = T;

export type SafeApiResponse<TEndpoint> = TEndpoint extends { responses: infer TResponses }
  ? TResponses extends Record<string | number, unknown>
    ? TypedApiResponse<
        InferSchemaValue<TResponses>,
        TEndpoint extends { responseHeaders: infer THeaders } ? InferSchemaValue<THeaders> : never
      >
    : never
  : never;

export type InferResponseByStatus<TEndpoint, TStatusCode> = Extract<
  SafeApiResponse<TEndpoint>,
  { status: TStatusCode }
>;

/**
 * Success-body payload — InferSchemaValue only on success statuses.
 * Filter with extends {} like the old Extract { data: {} } so unknown bodies (e.g. 304) drop out.
 */
export type InferSuccessData<TEndpoint> = TEndpoint extends { responses: infer TResponses }
  ? {
      [K in keyof TResponses]: StatusCodeFromKey<K> extends infer TStatusCode extends number
        ? TStatusCode extends SuccessStatusCode
          ? Extract<InferSchemaValue<TResponses[K]>, {}>
          : never
        : never;
    }[keyof TResponses]
  : never;

type RequiredKeys<T> = {
  [P in keyof T]-?: undefined extends T[P] ? never : P;
}[keyof T];

type MaybeOptionalArg<T> = RequiredKeys<T> extends never ? [config?: T] : [config: T];
type NotNever<T> = [T] extends [never] ? false : true;

export type ApiQueryOptions = {
  /** Override whether a generated TanStack Query consumes TanStack Query's AbortSignal. */
  consumeQuerySignal?: boolean;
};

/** Call options merged onto inferred endpoint parameters. */
type ApiRequestOptions = {
  overrides?: RequestInit;
  queryOptions?: ApiQueryOptions;
  withResponse?: boolean;
  throwOnStatusError?: boolean;
  validate?: ValidateSide;
};

/** Parameter bag for an endpoint + request options. */
export type ApiCallParams<TEndpoint> = TEndpoint extends { parameters: infer UParams }
  ? NotNever<InferSchemaInput<UParams>> extends true
    ? InferSchemaInput<UParams> & ApiRequestOptions
    : ApiRequestOptions
  : ApiRequestOptions;

/** Resolve response type from withResponse flag on the call config. */
export type ApiCallResult<TEndpoint, TParams> = TParams extends { withResponse: true }
  ? SafeApiResponse<TEndpoint>
  : InferSuccessData<TEndpoint>;

export type ValidateSide = "none" | "input" | "output" | "both";
export type OnValidate = (ctx: {
  side: "input" | "output";
  method: string;
  path: string;
  schema: unknown;
  value: unknown;
}) => unknown | Promise<unknown>;

// </ApiClientTypes>

// <TypedStatusError>
export class TypedStatusError<TData = unknown> extends Error {
  response: TypedErrorResponse<TData, ErrorStatusCode, unknown>;
  status: number;
  constructor(response: TypedErrorResponse<TData, ErrorStatusCode, unknown>) {
    super(`HTTP ${response.status}: ${response.statusText}`);
    this.name = "TypedStatusError";
    this.response = response;
    this.status = response.status;
  }
}
// </TypedStatusError>

// <ApiClient>
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export class ApiClient {
  baseUrl: string = "";
  successStatusCodes = successStatusCodes;
  errorStatusCodes = errorStatusCodes;
  validate: ValidateSide = "none";
  onValidate?: OnValidate;

  constructor(
    public fetcher: Fetcher,
    options?: { validate?: ValidateSide; onValidate?: OnValidate },
  ) {
    if (options?.validate !== undefined) this.validate = options.validate;
    if (options?.onValidate) this.onValidate = options.onValidate;
  }

  setBaseUrl(baseUrl: string) {
    this.baseUrl = baseUrl;
    return this;
  }

  setValidate(validate: ValidateSide) {
    this.validate = validate;
    return this;
  }

  setOnValidate(onValidate: OnValidate | undefined) {
    if (onValidate === undefined) {
      delete this.onValidate;
    } else {
      this.onValidate = onValidate;
    }
    return this;
  }

  /**
   * Replace path parameters in URL
   * Supports both OpenAPI format {param} and Express format :param
   */
  defaultDecodePathParams = (url: string, params: unknown, styles?: Record<string, ParameterSerialization>): string => {
    const record = (params ?? {}) as Record<string, unknown>;
    const encode = (value: unknown) => encodeURIComponent(String(value));
    const serialize = (key: string, value: unknown): string => {
      const parameterStyle = styles?.[key];
      const style = parameterStyle?.style ?? "simple";
      const explode = parameterStyle?.explode ?? false;
      if (style === "label") {
        if (Array.isArray(value))
          return (
            "." +
            value
              .filter((item) => item != null)
              .map(encode)
              .join(explode ? "." : ",")
          );
        if (isPlainObject(value)) {
          const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null);
          return (
            "." +
            (explode
              ? entries.map(([name, item]) => encode(name) + "=" + encode(item)).join(".")
              : entries.flatMap(([name, item]) => [encode(name), encode(item)]).join(","))
          );
        }
        return "." + encode(value);
      }
      if (style === "matrix") {
        if (Array.isArray(value))
          return explode
            ? value
                .filter((item) => item != null)
                .map((item) => ";" + key + "=" + encode(item))
                .join("")
            : ";" +
                key +
                "=" +
                value
                  .filter((item) => item != null)
                  .map(encode)
                  .join(",");
        if (isPlainObject(value)) {
          const entries = Object.entries(value as Record<string, unknown>).filter(([, item]) => item != null);
          return explode
            ? entries.map(([name, item]) => ";" + encode(name) + "=" + encode(item)).join("")
            : ";" + key + "=" + entries.flatMap(([name, item]) => [encode(name), encode(item)]).join(",");
        }
        return ";" + key + "=" + encode(value);
      }
      if (Array.isArray(value))
        return value
          .filter((item) => item != null)
          .map(encode)
          .join(",");
      if (isPlainObject(value)) {
        return Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => item != null)
          .map(([name, item]) => (explode ? encode(name) + "=" + encode(item) : [encode(name), encode(item)]))
          .flat()
          .join(",");
      }
      return encode(value);
    };
    return url
      .replace(/{([^}]+)}/g, (_, key: string) => (record[key] != null ? serialize(key, record[key]) : `{${key}}`))
      .replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) =>
        record[key] != null ? serialize(key, record[key]) : `:${key}`,
      );
  };

  /** Uses URLSearchParams, skips null/undefined values */
  defaultEncodeSearchParams = (
    queryParams: unknown,
    styles?: Record<string, ParameterSerialization>,
  ): URLSearchParams | undefined => {
    if (!queryParams || typeof queryParams !== "object") return;

    const searchParams = new URLSearchParams();
    const rawEntries: Array<{ key: string; value: string; allowReserved: boolean }> = [];
    const append = (key: string, value: unknown, allowReserved = false) => {
      const stringValue = String(value);
      searchParams.append(key, stringValue);
      rawEntries.push({ key, value: stringValue, allowReserved });
    };
    const encodeQueryComponent = (value: string, allowReserved: boolean) => {
      const encoded = encodeURIComponent(value);
      return allowReserved
        ? encoded.replace(/%3A|%2F|%3F|%40|%21|%24|%26|%27|%28|%29|%2A|%2B|%2C|%3B|%3D|%5B|%5D/gi, (part) =>
            decodeURIComponent(part),
          )
        : encoded;
    };
    Object.defineProperty(searchParams, "toString", {
      value: () =>
        rawEntries
          .map(
            ({ key, value, allowReserved }) =>
              `${encodeQueryComponent(key, false)}=${encodeQueryComponent(value, allowReserved)}`,
          )
          .join("&"),
    });
    Object.entries(queryParams as Record<string, unknown>).forEach(([key, value]) => {
      if (value != null) {
        // Skip null/undefined values
        const parameterStyle = styles?.[key];
        const style = parameterStyle?.style ?? "form";
        const explode = parameterStyle?.explode ?? true;
        const allowReserved = parameterStyle?.allowReserved === true;
        if (Array.isArray(value)) {
          if (style === "spaceDelimited")
            append(
              key,
              value
                .filter((item) => item != null)
                .map(String)
                .join(" "),
              allowReserved,
            );
          else if (style === "pipeDelimited")
            append(
              key,
              value
                .filter((item) => item != null)
                .map(String)
                .join("|"),
              allowReserved,
            );
          else if (explode) value.forEach((val) => val != null && append(key, val, allowReserved));
          else
            append(
              key,
              value
                .filter((item) => item != null)
                .map(String)
                .join(","),
              allowReserved,
            );
        } else if (isPlainObject(value)) {
          const entries = Object.entries(value as Record<string, unknown>).filter(
            ([, nestedValue]) => nestedValue != null,
          );
          if (style === "deepObject") {
            for (const [nestedKey, nestedValue] of entries) {
              if (Array.isArray(nestedValue))
                nestedValue.forEach((item) => item != null && append(`${key}[${nestedKey}]`, item, allowReserved));
              else append(`${key}[${nestedKey}]`, nestedValue, allowReserved);
            }
          } else if (explode) {
            for (const [nestedKey, nestedValue] of entries) {
              if (Array.isArray(nestedValue))
                nestedValue.forEach((item) => item != null && append(nestedKey, item, allowReserved));
              else append(nestedKey, nestedValue, allowReserved);
            }
          } else {
            append(
              key,
              entries
                .flatMap(([nestedKey, nestedValue]) => [
                  nestedKey,
                  ...(Array.isArray(nestedValue) ? nestedValue : [nestedValue]),
                ])
                .map(String)
                .join(","),
              allowReserved,
            );
          }
        } else {
          append(key, value, allowReserved);
        }
      }
    });

    return searchParams;
  };

  /** Append cookie params as a Cookie header (or merge into existing). */
  defaultEncodeCookies = (cookies: unknown, headers: Headers): void => {
    if (!cookies || typeof cookies !== "object") return;
    const parts = Object.entries(cookies as Record<string, unknown>)
      .filter(([, value]) => value != null)
      .map(([key, value]) => `${key}=${String(value)}`);
    if (!parts.length) return;
    const existing = headers.get("cookie");
    headers.set("cookie", existing ? `${existing}; ${parts.join("; ")}` : parts.join("; "));
  };

  defaultParseResponseData = async (response: FetcherResponse): Promise<unknown> => {
    const contentType = response.headers.get("content-type") ?? "";
    const normalizedContentType = contentType.toLowerCase();
    if (normalizedContentType.includes("text/event-stream")) {
      return response.body ?? null;
    }
    if (normalizedContentType.startsWith("text/")) {
      return await response.text();
    }

    if (normalizedContentType.startsWith("application/octet-stream")) {
      return new Blob([await response.arrayBuffer()]);
    }

    if (
      normalizedContentType.includes("application/json") ||
      (normalizedContentType.includes("application/") && normalizedContentType.includes("json")) ||
      normalizedContentType === "*/*"
    ) {
      try {
        return await response.json();
      } catch {
        return undefined;
      }
    }

    return;
  };

  // <ApiClient.get>
  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  get<Path extends keyof GetEndpoints, TEndpoint extends GetEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  get<Path extends keyof GetEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("get", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.get>

  // <ApiClient.post>
  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  post<Path extends keyof PostEndpoints, TEndpoint extends PostEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  post<Path extends keyof PostEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("post", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.post>

  // <ApiClient.patch>
  patch<Path extends keyof PatchEndpoints, TEndpoint extends PatchEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  patch<Path extends keyof PatchEndpoints, TEndpoint extends PatchEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  patch<Path extends keyof PatchEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("patch", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.patch>

  // <ApiClient.delete>
  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  delete<Path extends keyof DeleteEndpoints, TEndpoint extends DeleteEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  delete<Path extends keyof DeleteEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("delete", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.delete>

  // <ApiClient.put>
  put<Path extends keyof PutEndpoints, TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  put<Path extends keyof PutEndpoints, TEndpoint extends PutEndpoints[Path]>(
    path: Path,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  put<Path extends keyof PutEndpoints>(path: Path, ...params: [config?: unknown]): Promise<unknown> {
    return this.request("put", path, params[0] as never) as Promise<unknown>;
  }
  // </ApiClient.put>

  // <ApiClient.request>
  /**
   * Generic request method with full type-safety for any endpoint
   */
  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(
    method: TMethod,
    path: TPath,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse: true;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse: true;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<SafeApiResponse<TEndpoint>>;

  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(
    method: TMethod,
    path: TPath,
    ...params: MaybeOptionalArg<
      TEndpoint extends { parameters: infer UParams }
        ? NotNever<InferSchemaInput<UParams>> extends true
          ? InferSchemaInput<UParams> & {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
          : {
              overrides?: RequestInit;
              queryOptions?: ApiQueryOptions;
              withResponse?: false;
              throwOnStatusError?: boolean;
              validate?: ValidateSide;
            }
        : {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: false;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          }
    >
  ): Promise<InferSuccessData<TEndpoint>>;

  request<
    TMethod extends keyof EndpointByMethod,
    TPath extends keyof EndpointByMethod[TMethod],
    TEndpoint extends EndpointByMethod[TMethod][TPath],
  >(method: TMethod, path: TPath, ...params: [config?: unknown]): Promise<unknown> {
    return (async () => {
      const requestParams = params[0] as
        | (EndpointParameters & {
            overrides?: RequestInit;
            queryOptions?: ApiQueryOptions;
            withResponse?: boolean;
            throwOnStatusError?: boolean;
            validate?: ValidateSide;
          })
        | undefined;
      const withResponse = requestParams?.withResponse;
      const throwOnStatusError = requestParams?.throwOnStatusError ?? (withResponse ? false : true);
      let overrides = requestParams?.overrides;

      const parametersToSend: EndpointParameters = {};
      if (requestParams?.body !== undefined) parametersToSend.body = requestParams.body;
      if (requestParams?.query !== undefined) parametersToSend.query = requestParams.query;
      if (requestParams?.header !== undefined) parametersToSend.header = requestParams.header;
      if (requestParams?.path !== undefined) parametersToSend.path = requestParams.path;
      if (requestParams?.cookie !== undefined) parametersToSend.cookie = requestParams.cookie;

      const resolvedPath = (this.fetcher.decodePathParams ?? this.defaultDecodePathParams)(
        this.baseUrl + (path as string),
        parametersToSend.path ?? {},
        endpointParameterStyles[method]?.[path]?.path,
      );
      const url = new URL(resolvedPath);
      const urlSearchParams = (this.fetcher.encodeSearchParams ?? this.defaultEncodeSearchParams)(
        parametersToSend.query,
        endpointParameterStyles[method]?.[path]?.query,
      );

      if (parametersToSend.cookie) {
        const headers = new Headers((overrides as RequestInit | undefined)?.headers);
        (this.fetcher.encodeCookies ?? this.defaultEncodeCookies)(parametersToSend.cookie, headers);
        overrides = { ...overrides, headers };
      }

      const parameterStyles = endpointParameterStyles[method]?.[path as string];
      const response = await this.fetcher.fetch({
        method: method,
        path: path as string,
        url,
        ...(urlSearchParams ? { urlSearchParams } : {}),
        ...(Object.keys(parametersToSend).length ? { parameters: parametersToSend } : {}),
        requestFormat: endpointRequestFormats[method]?.[path] ?? "json",
        ...(parameterStyles ? { parameterStyles } : {}),
        security: endpointSecurityRequirements[method]?.[path] ?? defaultSecurityRequirements,
        ...(overrides ? { overrides } : {}),
        throwOnStatusError,
      });
      const responseFormat = endpointResponseFormats[method]?.[path] ?? "json";
      let data =
        responseFormat === "sse"
          ? (response.body ?? null)
          : await (this.fetcher.parseResponseData ?? this.defaultParseResponseData)(response);

      const typedResponse = Object.assign(response, {
        data: data,
        json: () => Promise.resolve(data),
      }) as SafeApiResponse<TEndpoint>;

      if (throwOnStatusError && (errorStatusCodes as readonly number[]).includes(response.status)) {
        throw new TypedStatusError(typedResponse as TypedErrorResponse<unknown, ErrorStatusCode, unknown>);
      }

      return withResponse ? typedResponse : data;
    })();
  }
  // </ApiClient.request>
}

export function createApiClient(
  fetcher: Fetcher,
  baseUrl?: string,
  options?: { validate?: ValidateSide; onValidate?: OnValidate },
) {
  return new ApiClient(fetcher, options).setBaseUrl(baseUrl ?? "");
}

/**
 Example usage:
 const api = createApiClient((method, url, params) =>
   fetch(url, { method, body: JSON.stringify(params) }).then((res) => res.json()),
 );
 api.get("/users").then((users) => console.log(users));
 api.post("/users", { body: { name: "John" } }).then((user) => console.log(user));
 api.put("/users/:id", { path: { id: 1 }, body: { name: "John" } }).then((user) => console.log(user));

 // With error handling
 const result = await api.get("/users/{id}", { path: { id: "123" }, withResponse: true });
 if (result.ok) {
   // Access data directly
   const user = result.data;
   console.log(user);

   // Or use the json() method for compatibility
   const userFromJson = await result.json();
   console.log(userFromJson);
 } else {
   const error = result.data;
   console.error(`Error ${result.status}:`, error);
 }
*/

// </ApiClient>
