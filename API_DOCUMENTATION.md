# TricityMatch API Documentation

This document outlines the REST API endpoints available in the TricityMatch backend. 
Unless otherwise specified, all endpoints are assumed to be prefixed with the base API path (e.g., `/api`).

## Authentication (`/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/signup` | Public | Register a new user account. Rate-limited. |
| `POST` | `/login` | Public | Authenticate a user and receive tokens. Rate-limited (account lockout support). |
| `POST` | `/refresh` | Public | Request a new access token using a refresh token. |
| `POST` | `/forgot-password` | Public | Initiate the password reset process. |
| `POST` | `/reset-password` | Public | Reset a password using a valid reset token. |
| `GET` | `/me` | Protected | Retrieve the currently authenticated user's details. |
| `POST` | `/logout` | Protected | Log out the current session. |
| `POST` | `/logout-all` | Protected | Log out from all active sessions across devices. |
| `POST` | `/change-password` | Protected | Change the user's password using the current password. |
| `GET` | `/sessions` | Protected | List all active sessions for the authenticated user. |
| `DELETE` | `/sessions/:sessionId` | Protected | Revoke a specific session by its ID. |
| `DELETE` | `/account` | Protected | Soft-delete the user's account (requires password confirmation). |

## Profile (`/profile`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/me` | Protected | Get the authenticated user's own profile. |
| `PUT` | `/me` | Protected | Update the user's profile. Supports `multipart/form-data` for file uploads. |
| `GET` | `/me/stats` | Protected | Get profile statistics (e.g., views, completion percentage). |
| `GET` | `/me/viewers` | Premium | Get a list of users who have viewed this profile. |
| `DELETE` | `/me/photo` | Protected | Delete a specific photo from the user's uploaded gallery. |
| `DELETE` | `/me/profile-photo` | Protected | Delete the user's main profile picture. |
| `PUT` | `/privacy` | Protected | Update profile privacy settings. |
| `GET` | `/:userId` | Protected | Get another user's profile (subject to privacy rules). |
| `POST` | `/:userId/unlock-contact` | Premium | Spend unlock credits to view a user's contact details. |

## Search (`/search`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Search and filter profiles (age, religion, location, etc.). Rate-limited. |
| `GET` | `/suggestions` | Protected | Get AI-powered smart match suggestions with optional `?limit=` parameter. |

## Match / Swipe Actions (`/match`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/:userId` | Protected | Perform a match action (like, pass, or shortlist) on a user. Rate-limited. |
| `GET` | `/likes` | Premium | Retrieve profiles of users who have liked the authenticated user. |
| `GET` | `/shortlist` | Protected | Retrieve profiles that the authenticated user has shortlisted. |
| `GET` | `/mutual` | Protected | Retrieve mutual matches (users who liked each other). |

## Chat (`/chat`)

**Note:** All chat routes are restricted to **Premium / Elite** subscribers.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/conversations` | Premium | Get a paginated list of all active conversations. |
| `GET` | `/messages/:userId` | Premium | Get the chat history with a specific user. |
| `POST` | `/messages` (or `/send`) | Premium | Send a new message to a specific user. Rate-limited. |
| `PUT` | `/messages/:messageId` | Premium | Edit a previously sent message. |
| `DELETE` | `/messages/:messageId` | Premium | Delete a specific message. |

## Subscriptions (`/subscription`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/plans` | Public | Retrieve a list of all available subscription plans. |
| `POST` | `/webhook` | Public | Razorpay webhook endpoint for receiving payment status updates via HMAC signature verification. |
| `GET` | `/my-subscription` | Protected | Get details of the current user's active subscription. |
| `POST` | `/create-order` | Protected | Create a new Razorpay payment order. |
| `POST` | `/verify-payment` | Protected | Verify the payment signature returned by Razorpay. |
| `GET` | `/history` | Protected | View the user's payment history. |
| `GET` | `/invoice/:subscriptionId` | Protected | Download the PDF invoice for a past subscription payment. |

## Block & Report (`/block`, `/report`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/block/:userId` | Protected | Block a specific user from interacting with or viewing the current user. |
| `DELETE` | `/block/:userId` | Protected | Unblock a specific user. |
| `GET` | `/block/` | Protected | Get a list of all users blocked by the authenticated user. |
| `POST` | `/report/:userId` | Protected | Report a specific user (requires passing a `reason` in the payload). |

## Notifications (`/notifications`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/` | Protected | Fetch a list of user notifications. |
| `GET` | `/unread-count` | Protected | Fetch the integer count of unread notifications. |
| `PUT` | `/read-all` | Protected | Mark all of the user's notifications as read. |
| `PUT` | `/:id/read` | Protected | Mark a single specific notification as read. |
| `DELETE` | `/:id` | Protected | Delete a single specific notification. |

## Verification (`/verification`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/status` | Protected | Check the current status of the user's ID/Profile verification. |
| `POST` | `/submit` | Protected | Submit identity documents for verification (supports `multipart/form-data`). |

## Admin (`/admin`)

**Note:** All administrative routes are protected and strictly require an **Admin** role.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/users` | Admin | Search and browse registered users with pagination. |
| `POST` | `/users` | Admin | Manually create a new user account. |
| `GET` | `/users/:userId` | Admin | Get comprehensive details on a specified user. |
| `PUT` | `/users/:userId/status` | Admin | Update a user's account status (e.g., active, suspended). |
| `PUT` | `/users/:userId/subscription` | Admin | Manually assign or modify a user's subscription tier. |
| `GET` | `/verifications` | Admin | Fetch a list of pending user verification requests. |
| `PUT` | `/verifications/:verificationId` | Admin | Update a verification request's status (Approve or Reject). |
| `GET` | `/analytics` | Admin | Fetch generalized platform statistics and usage metrics. |
| `GET` | `/revenue` | Admin | Fetch financial/revenue transaction reports. |
| `GET` | `/reports` | Admin | Fetch user complaints and reports. |
| `PUT` | `/reports/:reportId` | Admin | Update a report's status (e.g., reviewed, dismissed). |
| `GET` | `/invoice/:subscriptionId` | Admin | Admin access to retrieve invoices for any subscription. |
