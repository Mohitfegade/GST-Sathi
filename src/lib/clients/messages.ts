/**
 * Centralized user-facing messages, field labels, helpers, and error strings
 * for client business management in GST Saathi.
 *
 * Rules:
 * - Plain English for non-technical users and small business owners.
 * - Short sentences, friendly and clear tone.
 * - Zero tax jargon.
 * - Zero emojis.
 */

export const CLIENT_MESSAGES = {
  // 1. Success notifications
  success: {
    clientCreated: 'Client added successfully.',
    clientUpdated: 'Client details updated successfully.',
    clientArchived: 'Client hidden from active list.',
    clientRestored: 'Client restored to active list.',
    inviteCreated: 'Invite link created.',
    inviteCopied: 'Invite link copied to clipboard.',
    inviteRevoked: 'Invite link revoked.',
  },

  // 2. Validation and action error messages
  errors: {
    nameRequired: 'Please enter the legal business name.',
    gstinRequired: 'Please enter the GSTIN.',
    gstinInvalid: 'Please enter a valid 15-character GSTIN.',
    gstinChecksumFailed: 'GSTIN checksum verification failed. Please check the number.',
    duplicateGstin: 'A client with this GSTIN is already active in your firm.',
    schemeRequired: 'Please select a GST scheme.',
    turnoverRequired: 'Please select a yearly turnover band.',
    sellingTypeRequired: 'Please select at least one: tax-free or taxable goods.',
    permissionDenied: 'Only firm admins can perform this action.',
    onlyAdminCanArchive: 'Only firm admins can hide clients.',
    onlyAdminCanRestore: 'Only firm admins can restore clients.',
    onlyAdminCanInvite: 'Only firm admins can create or revoke invites.',
    clientNotFound: 'Client not found.',
    clientAlreadyArchived: 'This client is already hidden.',
    clientNotArchived: 'This client is already active.',
    cannotRestoreDuplicateGstin: 'Cannot restore client because another active client already uses this GSTIN.',
    inviteNotFound: 'Invite link not found.',
    inviteAlreadyAccepted: 'This invite has already been accepted.',
    inviteExpired: 'This invite link has expired.',
    generic: 'Something went wrong. Please try again.',
    network: 'Network connection issue. Please check your internet connection.',
  },

  // 3. Form field labels, helpers, and placeholders
  fields: {
    legalName: {
      label: 'Legal business name',
      helper: 'As registered on the GST certificate',
      placeholder: 'e.g. Om Enterprises Private Limited',
    },
    tradeName: {
      label: 'Trade / shop name (optional)',
      helper: 'Name on your shop board or storefront',
      placeholder: 'e.g. Om Supermarket',
    },
    gstin: {
      label: 'GSTIN',
      helper: '15-digit Goods and Services Tax Identification Number',
      placeholder: '27AAAAA0000A1Z5',
    },
    scheme: {
      label: 'GST scheme',
      helper: 'How this business files and pays GST',
    },
    turnover: {
      label: 'Yearly turnover band',
      helper: 'Annual turnover from the previous financial year',
    },
    sellingTypes: {
      label: 'What the shop sells',
      helper: 'Select at least one option',
      sellsTaxFree: 'Sells tax-free goods',
      sellsTaxFreeHelper: 'Exempt items like fresh milk, vegetables, unbranded grains',
      sellsTaxable: 'Sells taxable goods',
      sellsTaxableHelper: 'Items subject to standard GST rates (5%, 12%, 18%, or 28%)',
    },
    language: {
      label: 'Preferred language',
      helper: 'Language used for notifications and the owner portal',
    },
  },

  // 4. GST Schemes
  schemes: {
    regular: {
      label: 'Regular',
      helper: 'Monthly return filing for businesses above ₹5 Crore or choosing monthly returns',
    },
    qrmp: {
      label: 'QRMP',
      helper: 'Quarterly filing with monthly tax payment for turnover up to ₹5 Crore',
    },
    composition: {
      label: 'Composition',
      helper: 'Simplified quarterly tax for small local businesses (lower tax rate)',
    },
    unregistered: {
      label: 'Unregistered',
      helper: 'Business is not registered under GST',
    },
  },

  // 5. Yearly Turnover Bands (AATO)
  turnoverBands: {
    below_40l: {
      label: 'Below ₹40 Lakhs',
      helper: 'Below ₹40 Lakhs',
    },
    '40l_to_1_5cr': {
      label: '₹40 Lakhs to ₹1.5 Crore',
      helper: '₹40 Lakhs to ₹1.5 Crore',
    },
    '1_5cr_to_5cr': {
      label: '₹1.5 Crore to ₹5 Crore',
      helper: '₹1.5 Crore to ₹5 Crore',
    },
    above_5cr: {
      label: 'Above ₹5 Crore',
      helper: 'Above ₹5 Crore',
    },
  },

  // 6. Selling types labels
  sellingTypes: {
    taxFree: 'Sells tax-free goods',
    taxable: 'Sells taxable goods',
  },

  // 7. Preferred Languages
  languages: {
    en: 'English',
    hi: 'हिंदी (Hindi)',
    mr: 'मराठी (Marathi)',
  },

  // 8. Archive & Restore Confirmation Dialogs
  archiveDialog: {
    title: 'Hide this client? Their data is kept.',
    description: 'You can restore this client at any time. Archived clients do not appear in the active list.',
    confirmButton: 'Hide client',
    cancelButton: 'Keep client',
    banner: 'This client is currently hidden.',
  },

  restoreDialog: {
    title: 'Restore this client?',
    description: 'This client will return to your active list.',
    confirmButton: 'Restore client',
    cancelButton: 'Cancel',
  },

  // 9. Status badge labels (matches CLIENT_STATUS_LABELS in types.ts)
  statusBadges: {
    noActivity: 'No activity yet',
    documentsWaiting: 'Documents waiting',
    needsAttention: 'Needs attention',
    readyForReview: 'Ready for review',
    filed: 'Filed',
  },

  // Plain English descriptions of compliance statuses
  statusDescriptions: {
    'No activity yet': 'No return periods or documents uploaded yet.',
    'Documents waiting': 'Return period open, waiting for bills or GSTR-2B.',
    'Needs attention': 'Unmatched invoices or differences found.',
    'Ready for review': 'Reconciliation complete, ready for your review.',
    Filed: 'Return filed on the GST portal.',
  },

  // 10. Owner Access & Portal Invites
  ownerAccess: {
    title: 'Client portal access',
    subtitle: 'Invite the business owner to upload bills directly from their phone.',
    statusNone: 'No invite sent yet',
    statusInvited: 'Invite link pending (waiting for owner)',
    statusActive: 'Owner has active portal access',
    createInvite: 'Create invite link',
    creatingInvite: 'Creating link...',
    copyInvite: 'Copy link',
    copied: 'Copied!',
    shareWhatsApp: 'Share on WhatsApp',
    revokeInvite: 'Revoke invite',
    revokingInvite: 'Revoking...',
    revokeDialogTitle: 'Revoke this invite link?',
    revokeDialogDescription: 'The current link will stop working immediately. You can generate a new invite at any time.',
    revokeConfirmButton: 'Revoke invite',
    revokeCancelButton: 'Cancel',
    expiresNotice: 'Invite links expire after 7 days.',
    whatsAppText: 'Namaste! Here is your secure GST Saathi link to share bills with your CA:',
  },

  // 11. Buttons and Action Controls
  buttons: {
    addClient: 'Add client',
    addingClient: 'Adding client...',
    saveChanges: 'Save changes',
    savingChanges: 'Saving...',
    cancel: 'Cancel',
    backToClients: 'Back to clients',
    editClient: 'Edit details',
    hideClient: 'Hide client',
    restoreClient: 'Restore client',
    viewClient: 'View client',
    search: 'Search',
    resetFilters: 'Reset filters',
  },

  // 12. Page Headings, Subtitles & Empty States
  listPage: {
    title: 'Clients',
    subtitle: 'Manage your client businesses and compliance status.',
    addClientButton: 'Add client',
    searchPlaceholder: 'Search by business name or GSTIN...',
    allSchemes: 'All schemes',
    allStatuses: 'All statuses',
    emptyTitle: 'No clients yet',
    emptySubtitle: 'Get started by adding your first client business.',
    emptySearchTitle: 'No clients found',
    emptySearchSubtitle: 'No clients match your search. Try adjusting the search term or filters.',
    paginationPrevious: 'Previous',
    paginationNext: 'Next',
    paginationPage: (current: number, total: number) => `Page ${current} of ${total}`,
    activeTab: 'Active clients',
    archivedTab: 'Hidden clients',
  },

  addPage: {
    title: 'Add a client business',
    subtitle: 'Enter the business details. You can invite the owner to share bills after adding.',
    sectionBusinessInfo: '1. Business information',
    sectionTaxScheme: '2. Tax scheme and turnover band',
    sectionSellingTypes: '3. What the shop sells',
  },

  editPage: {
    title: 'Edit client business',
    subtitle: 'Update business information, tax settings, or hide this client.',
  },

  detailPage: {
    tabs: {
      overview: 'Overview',
      bills: 'Bills',
      gstr2b: 'GSTR-2B',
      returns: 'Returns',
    },
    comingNext: {
      title: 'Coming next',
      billsDescription: 'Purchase and sales bill uploads will be available here in the next update. Clients will be able to upload bill photos and PDFs.',
      gstr2bDescription: 'Government GSTR-2B reconciliation files will be matched here.',
      returnsDescription: 'Draft GSTR-1 and GSTR-3B summaries will be prepared here for your review.',
    },
  },
} as const;

export type ClientMessages = typeof CLIENT_MESSAGES;

// Convenience named sub-exports
export const CLIENT_SUCCESS = CLIENT_MESSAGES.success;
export const CLIENT_ERRORS = CLIENT_MESSAGES.errors;
export const CLIENT_FIELDS = CLIENT_MESSAGES.fields;
export const CLIENT_SCHEMES = CLIENT_MESSAGES.schemes;
export const CLIENT_TURNOVER_BANDS = CLIENT_MESSAGES.turnoverBands;
export const CLIENT_STATUS_BADGES = CLIENT_MESSAGES.statusBadges;
