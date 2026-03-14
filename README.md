# Exam Registration Portal (Static Website)

This is a simple exam registration portal website with:

- Student registration
- Student login
- Student dashboard:
  - Exam registration
  - Exam result
  - Student profile

## Run

Open `index.html` in your browser.

## Home and About

- Home: `index.html`
- About: `about.html`
- Forgot password: `forgot-password.html` (uses Email/Student ID + Date of Birth)

## Staff Login

Open `staff-login.html` for staff access, then it redirects to `staff-dashboard.html`.

## Database Page

Open `database.html` to view/export the collected data stored in LocalStorage.

## Notes

- This is a static (frontend-only) project.
- Student accounts and portal data are stored in the browser using LocalStorage.
- Student registration includes date of birth and an optional photo (stored as a Data URL in LocalStorage).
- Exam results are published by staff from `staff-dashboard.html`.
- Home page hero image: add your image at `images/moolampilly_college.png` (used in `index.html`).
- If you want to reset everything, clear the site data in your browser or remove these LocalStorage keys:
  - `ep_users_v1`
  - `ep_session_v1`
  - `ep_admin_pin_hash_v1`
  - `ep_admin_session_v1`
