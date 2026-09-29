// Every notification (signal) type, recipient kind and channel the backend can
// send to the notification screens. Mirrors AP Backend: the registry in
// internal/model/notification/types (Register), eventForm.AudienceKind and the
// email/in_app channels. Add a value here together with its
// admin.notif.type.* / admin.notif.audience.* / admin.notif.channel.* keys —
// notifType.test.ts fails while a key is missing in uk or en.
export const NOTIFICATION_TYPES = [
  "account_exists",
  "account_inactivity_warning",
  "continue_registration",
  "email_confirmation",
  "event.application.submitted",
  "event.lab.failed",
  "event.manager.assigned",
  "exercise.proposal.approved",
  "exercise.proposal.rejected",
  "exercise.proposal.submitted",
  "flag_accepted",
  "participant.approval_registration.approved",
  "participant.approval_registration.rejected",
  "participant.approval_registration.submitted",
  "participant.enrolled",
  "participant.event.finished",
  "participant.event.results_published",
  "participant.event.start_reminder",
  "participant.invitation.accepted",
  "participant.invitation.declined",
  "participant.invitation.expired",
  "participant.invitation.revoked",
  "participant.invitation.sent",
  "participant.open_registration.completed",
  "participant.team_invitation.sent",
  "password_reset",
  "user_invitation",
] as const

export const AUDIENCE_KINDS = [
  "signal_subject",
  "all_participants",
  "all_captains",
  "selected_users",
  "selected_teams",
  "participants_without_team",
  "teams_below_size",
] as const

export const NOTIFICATION_CHANNELS = ["email", "in_app"] as const
