# How ReceiptMind Works

This page explains what happens from the moment you upload a receipt until it is saved in the system.

## 1. Uploading a Receipt

1. **You Pick a File:** You click "Upload" and choose a picture or PDF.
2. **Sent to Server:** The website sends the file to the server.
3. **Saving the File:** The server saves the file and creates a new entry in the database. It marks the status as "Processing".
4. **Quick Response:** The server tells the website "I got it!", and the website shows a message saying the receipt is being processed.

## 2. Reading the Receipt (In the Background)

1. **Asking the AI:** While you are doing other things, the server sends the receipt to the AI (Google Gemini).
2. **AI Analysis:** The AI looks at the picture and finds the store name, the price, and the date.
3. **Applying Rules:** The server checks if you have any "Rules". For example, if the store is "Amazon", it might automatically set the category to "Office Supplies".
4. **Updating the Database:** The server saves all this new information and changes the status to "Processed". If the AI was confused, it changes the status to "Needs Review".

## 3. Watching for Updates

1. **The Website Checks:** Every few seconds, the website asks the server, "Is the receipt finished yet?".
2. **Live Update:** As soon as the server says "Yes", the website updates the list to show the store name and the price.
3. **Notification:** You get a small message (a toast) at the bottom of the screen saying the receipt is ready.

## 4. Fixing Mistakes

1. **User Review:** If you see something wrong, you click on the receipt.
2. **Editing:** You type in the correct information.
3. **Saving:** The server updates the database with your changes. If you changed the category, it might ask if you want to create a new rule for next time.
