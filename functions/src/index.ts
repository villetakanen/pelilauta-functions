import * as functions from 'firebase-functions';
import algoliasearch from 'algoliasearch'

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const ALGOLIA_ID = functions.config().algolia.app_id
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key
// const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key

const ALGOLIA_INDEX_NAME = 'pelilauta_discussion';
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY)

// Update the search index every time a thread post is written.
export const onThreadCreated = functions.firestore.document('stream/{threadId}').onCreate((snap, context) => {
  // Get the note document
  const note = snap.data()
  // Add an 'objectID' field which Algolia requires
  note.objectID = context.params.threadId;

  if (!client) throw new Error('algoliaClient not started')

  // Write to the algolia index
  const index = client.initIndex(ALGOLIA_INDEX_NAME)
  
  if (!index) throw new Error('could not init index ' + ALGOLIA_INDEX_NAME)

  return index.saveObject(note)
})

/* export const threadKudos = functions.firestore.document('stream/{docID}')
  .onUpdate((change, context) => { 
    const likes = const
  }) */