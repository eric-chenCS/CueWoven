# CueWoven 3.3.56 beta

**Problem reports go to support email.** "Report a bug or error" under Library & settings → Diagnostics now opens a pre-filled email to support@fusilite.com in your email app instead of a GitHub issue. Nothing is sent until you send the email yourself. The report is plain text and kept short enough for email apps; "Copy report" remains for people without an email app. The report still contains only your description, CueWoven and browser versions, storage used and which features are on.

The privacy policy, the website's "Report a problem" link and the store listing's support contact now point to support@fusilite.com.

Validation: 408 unit tests pass, including the updated report tests (email address, subject, plain spaces and length). A new browser test, support-report, checks in Edge that the button builds the email link, opens no empty tab and no longer mentions GitHub; it joins the maintained set, which passes.
