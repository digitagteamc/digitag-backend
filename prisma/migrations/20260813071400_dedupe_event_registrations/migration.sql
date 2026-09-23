-- One ticket per mobile number, and one per email, within a given event.
-- Existing duplicates (test data from this feature's own QA) were cleaned
-- up manually before this migration was written — this only adds the
-- constraint, it doesn't touch any rows itself.

CREATE UNIQUE INDEX "EventRegistration_eventSlug_mobileNumber_key" ON "EventRegistration"("eventSlug", "mobileNumber");
CREATE UNIQUE INDEX "EventRegistration_eventSlug_email_key" ON "EventRegistration"("eventSlug", "email");
