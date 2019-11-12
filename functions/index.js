const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.onCreateFollower = functions.firestore
  .document("/followers/{userId}/userFollowers/{followerId}")
  .onCreate(async (snap, context) => {
    console.log("Follower Created", snap.id);
    const userId = context.params.userId;
    const followerId = context.params.followerId;

    const followedUserPostsRef = admin
      .firestore()
      .collection("posts")
      .doc(userId)
      .collection("userPosts");

    const timelinePostRef = admin
      .firestore()
      .collection("timeline")
      .doc(followerId)
      .collection("timelinePosts");

    const querySnapshot = await followedUserPostsRef.get();

    querySnapshot.forEach(doc => {
      if (doc.exists) {
        const postId = doc.id;
        const postData = doc.data();
        timelinePostRef.doc(postId).set(postData);
      }
    });
  });

exports.onDeleteFollower = functions.firestore
  .document("/followers/{userId}/userFollowers/{followerId}")
  .onDelete(async (snap, context) => {
    console.log("Follower Deleted", snap.id);
    const userId = context.params.userId;
    const followerId = context.params.followerId;

    const timelinePostRef = admin
      .firestore()
      .collection("timeline")
      .doc(followerId)
      .collection("timelinePosts")
      .where("ownerId", "==", userId);

    const querySnapshot = await timelinePostRef.get();
    querySnapshot.forEach(doc => {
      if (doc.exists) {
        doc.ref.delete();
      }
    });
  });

exports.onCreatePost = functions.firestore
  .document("/posts/{userId}/userPosts/{postId}")
  .onCreate(async (snapshot, context) => {
    const postCreated = snapshot.data();
    const userId = context.params.userId;
    const postId = context.params.postId;

    const userFollowersRef = admin
      .firestore()
      .collection("followers")
      .doc(userId)
      .collection("userFollowers");

    const querySnapshot = await userFollowersRef.get();
    querySnapshot.forEach(doc => {
      const followerId = doc.id;

      admin
        .firestore()
        .collection("timeline")
        .doc(followerId)
        .collection("timelinePosts")
        .doc(postId)
        .set(postCreated);
    });
  });

exports.onUpdatePost = functions.firestore
  .document("/posts/{userId}/userPosts/{postId}")
  .onUpdate(async (change, context) => {
    const postUpdated = change.after.data();
    const userId = context.params.userId;
    const postId = context.params.postId;

    const userFollowersRef = admin
      .firestore()
      .collection("followers")
      .doc(userId)
      .collection("userFollowers");

    const querySnapshot = await userFollowersRef.get();

    querySnapshot.forEach(doc => {
      const followerId = doc.id;

      admin
        .firestore()
        .collection("timeline")
        .doc(followerId)
        .collection("timelinePosts")
        .doc(postId)
        .get()
        .then(doc => {
          if (doc.exists) {
            doc.ref.update({ postUpdated });
          }
        });
    });
  });

exports.onDeletePost = functions.firestore
  .document("/posts/{userId}/userPosts/{postId}")
  .onDelete(async (snap, context) => {
    const userId = context.params.userId;
    const postId = context.params.postId;

    const userFollowersRef = admin
      .firestore()
      .collection("followers")
      .doc(userId)
      .collection("userFollowers");

    const querySnapshot = await userFollowersRef.get();

    querySnapshot.forEach(doc => {
      const followerId = doc.id;

      admin
        .firestore()
        .collection("timeline")
        .doc(followerId)
        .collection("timelinePosts")
        .doc(postId)
        .get()
        .then(doc => {
          if (doc.exists) {
            doc.ref.delete();
          }
        });
    });
  });

exports.oncreateActivityFeedItem = functions.firestore
  .document("/feed/{userId}/feedItems/{activityFeedItem}")
  .onCreate(async (snap, context) => {
    console.log("Activity Feed Item Created", snap.data());

    const userId = context.params.userId;
    const userRef = admin.firestore().doc(`users/${userId}`);
    const doc = await userRef.get();

    const androidNotificationToken = doc.data().androidNotificationToken;
    const activityFeedItem = snap.data();

    if (androidNotificationToken) {
      sendNotification(androidNotificationToken, activityFeedItem);
    } else {
      console.log("No token for user, cannot send notification");
    }

    function sendNotification(androidNotificationToken, activityFeedItem) {
      let body;

      switch (activityFeedItem.type) {
        case "comment":
          body = `${activityFeedItem.username} replied: ${activityFeedItem.commentData}`;
          break;

        case "like":
          body = `${activityFeedItem.username} liked your post`;
          break;

        case "follow":
          body = `${activityFeedItem.username} started following you`;
          break;

        default:
          break;
      }

      const message = {
        notification: { body },
        token: androidNotificationToken,
        data: { recipient: userId }
      };

      admin
        .messaging()
        .send(message)
        .then(response => {
          console.log("Successfully sent message", response);
        })
        .catch(error => {
          console.log("Error sending message", error);
        });
    }
  });
