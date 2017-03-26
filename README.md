# Overview

This is an endpoint meant to be run on webtask.io that handles backend Stripe processing for National DSA membership dues collection.  The main entrypoint is signup.js.

# Local Development

## Requirements
- Node 7 or higher


## Setup/Development
1. Clone the repository:
   ```
   git clone git@github.com:SeattleDSA/national-dsa-signup.git
   ```
2. Create a file called `.env` in the project root:
   ```
   STRIPE_SECRET_KEY=sk_test_************* # Obtain from someone who has it
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Tests can be run with:
   ```
   npm test
   ```