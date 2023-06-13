const express = require("express");
const app = express();
app.use(express.json());
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`Db Error: ${e.message}`);
  }
};
initializeDBAndServer();

//register user  API - 1

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;

  const checkingUser = `
        SELECT * 
        FROM user 
        WHERE  
            username='${username}'
    `;
  const checkoutUser = await db.get(checkingUser);
  console.log(checkoutUser);

  const encryptPassword = await bcrypt.hash(password, 10);

  if (checkoutUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const addUserQuery = `
                    INSERT INTO 
                        user(username,password,name,gender) 
                    VALUES (
                        '${username}',
                        '${encryptPassword}',
                        '${name}',
                        '${gender}'
                    );`;
      await db.run(addUserQuery);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login user API - 2
app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;

    const checkingLogUser = `
        SELECT * 
        FROM user 
        WHERE
            username='${username}';`;

    const checkUser = await db.get(checkingLogUser);

    if (checkUser === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const verifyPassword = await bcrypt.compare(password, checkUser.password);
      if (verifyPassword === true) {
        const payload = {
          username: username,
        };
        const jwtToken = await jwt.sign(payload, "secret");
        response.status(200);
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid password");
      }
    }
  } catch (e) {
    console.log(`Posting Error: ${e.message}`);
  }
});

//checking every API jwt Token

const authentication = (request, response, next) => {
  const authHead = request.headers["authorization"];

  let jwtToken;
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        const userDetails = await db.get(
          `SELECT * FROM user  WHERE username='${payload.username}';`
        );

        request.userId = userDetails.user_id;
        request.username = userDetails.username;

        console.log(payload.username);
        next();
      }
    });
  }
};

//get latest tweet of the user follower API - 3

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username, userId } = request;

  console.log(userId);
  try {
    const getTweetQuery = `
        SELECT 
            username,
            tweet,
            date_time AS dateTime
        FROM (follower INNER JOIN tweet ON user_id=following_user_id) AS T INNER JOIN user ON user.user_id=tweet.user_id 
        WHERE 
           follower.follower_user_id=${userId}
         ORDER BY  
            date_time DESC 
        LIMIT 4

       ;`;
    const result = await db.all(getTweetQuery);
    response.send(result);
  } catch (e) {
    console.log(`Get tweet Error:${e.message}`);
  }
});

//get user followers list API - 4

app.get("/user/following/", authentication, async (request, response) => {
  const { username, userId } = request;

  try {
    const getTweetQuery = `
        SELECT
            name
        FROM follower INNER JOIN user ON user_id=following_user_id
        WHERE 
           follower_user_id=${userId}
       ;`;
    const result = await db.all(getTweetQuery);
    response.send(result);
  } catch (e) {
    console.log(`Get tweet Error:${e.message}`);
  }
});

//GEt user followers name list API - 5
app.get("/user/followers/", authentication, async (request, response) => {
  const { username, userId } = request;

  try {
    const getTweetQuery = `
        SELECT
            name
        FROM follower INNER JOIN user ON follower_user_id=user_id
        WHERE 
           following_user_id=${userId}
       ;`;
    const result = await db.all(getTweetQuery);
    response.send(result);
  } catch (e) {
    console.log(`Get tweet Error:${e.message}`);
  }
});

//Get deatils on tweet ID API - 6
app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;

  try {
    const { userId } = request;
    const getTweetId = `
            SELECT *
            FROM follower INNER JOIN tweet ON follower_user_id=user_id
            WHERE  
                following_user_id=${userId}
         `;
    const [check] = await db.all(getTweetId);
    const checkID = check.tweet_id;
    // const followingId = check.following_user_id;

    //change the code API _ 6

    if (tweetId == checkID) {
      console.log(tweetId);
      const getTweetQuery = `
       SELECT 
            tweet,
          COUNT(DISTINCT(like_id)) AS likes,
          COUNT(DISTINCT(reply))AS replies,
          date_time AS dateTime
        FROM (tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id) AS T INNER JOIN reply ON T.tweet_id=reply.tweet_id
        WHERE 
           tweet.tweet_id=${tweetId} 
        GROUP BY 
            reply.user_id
      `;
      const result = await db.get(getTweetQuery);
      response.send(result);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (e) {
    console.log(`Getting tweet Id Error:${e.message}`);
  }
});

//get who like the user tweet API - 7
/*
app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;

    try {
      const { userId } = request;
      const getTweetId = `
            SELECT * 
            FROM (follower INNER JOIN tweet ON user_id=following_user_id) AS T INNER JOIN user ON user.user_id=tweet.user_id 
            WHERE 
                follower.follower_user_id=${userId};
            
         `;
      const [check] = await db.all(getTweetId);
      const checkID = check.tweet_id;
      console.log(checkID);
      console.log(checkID == tweetId);

      // change the code here .............API 7

      if (tweetId == checkID) {
        console.log(tweetId);
        const getTweetQuery = `
      SELECT 
         tweet,
         like_id,
         like.user_id,
         username
      FROM  (tweet INNER JOIN like ON tweet.tweet_id=like.tweet_id)AS T INNER JOIN user ON like.user_id=user.user_id
      WHERE 
            tweet.tweet_id=${tweetId} 
        ORDER BY 
            user.user_id
        
     ; `;
        const likes = await db.all(getTweetQuery);
        //const getName = likes.map((each) => {
        // return each.username;
        // });
        let result = [];

        for (let key in likes) {
          result.push(likes[key].username);
        }

        response.send({ likes: result });

        // response.send({ likes: getName });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (e) {
      console.log(`API - 7 Error:${e.message}`);
    }
  }
);*/

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await db.get(selectUserQuery);
    const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
    const tweetInfo = await db.get(getTweetQuery);

    const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
    const followingUsersObjectsList = await db.all(followingUsersQuery);
    const followingUsersList = followingUsersObjectsList.map((object) => {
      return object["following_user_id"];
    });
    if (!followingUsersList.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetInfo;
      const getLikesQuery = `
        SELECT user_id FROM like 
        WHERE tweet_id = ${tweet_id};
        `;
      const likedUserIdObjectsList = await db.all(getLikesQuery);
      const likedUserIdsList = likedUserIdObjectsList.map((object) => {
        return object.user_id;
      });
      const getLikedUsersQuery = `
      SELECT username FROM user 
      WHERE user_id IN (${likedUserIdsList});
      `;
      const likedUsersObjectsList = await db.all(getLikedUsersQuery);
      const likedUsersList = likedUsersObjectsList.map((object) => {
        return object.username;
      });
      response.send({
        likes: likedUsersList,
      });
    }
  }
);

//get who like the user tweet API - 8

/*app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;

    try {
      const { userId } = request;
      const getTweetId = `
            SELECT * 
            FROM (follower INNER JOIN tweet ON user_id=following_user_id) AS T INNER JOIN user ON user.user_id=tweet.user_id 
            WHERE 
                follower.follower_user_id=${userId};
         `;
      const [check] = await db.all(getTweetId);
      const checkID = check.tweet_id;

      if (tweetId == checkID) {
        console.log(tweetId);
        const getTweetQuery = `
      SELECT 
         
         name,
         reply
        
      FROM  (tweet INNER JOIN reply ON tweet.tweet_id=reply.tweet_id )AS T INNER JOIN user ON user.user_id=reply.user_id
      WHERE 
            tweet.tweet_id=${tweetId}
    
       
        ;`;
        const replies = await db.all(getTweetQuery);
        response.send({ replies });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (e) {
      console.log(`API - 8 Error:${e.message}`);
    }
  }
);
*/

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const selectUserQuery = `
    SELECT * FROM user WHERE username = '${username}';
    `;
    const dbUser = await db.get(selectUserQuery);
    const getTweetQuery = `
  SELECT * FROM tweet WHERE tweet_id = ${tweetId};
  `;
    const tweetInfo = await db.get(getTweetQuery);

    const followingUsersQuery = `
    SELECT following_user_id FROM follower 
    WHERE follower_user_id = ${dbUser.user_id};
  `;
    const followingUsersObjectsList = await db.all(followingUsersQuery);
    const followingUsersList = followingUsersObjectsList.map((object) => {
      return object["following_user_id"];
    });
    if (!followingUsersList.includes(tweetInfo.user_id)) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const { tweet_id, date_time } = tweetInfo;
      const getUserRepliesQuery = `
    SELECT user.name AS name, reply.reply AS reply
    FROM reply 
    INNER JOIN user ON reply.user_id = user.user_id 
    WHERE reply.tweet_id = ${tweet_id};
    `;
      const userRepliesObject = await db.all(getUserRepliesQuery);
      response.send({
        replies: userRepliesObject,
      });
    }
  }
);

//get user reply and like count  API - 9

app.get("/user/tweets/", authentication, async (request, response) => {
  const { username, userId } = request;

  try {
    const reply = 4;
    const getTweetQuery = `
        SELECT 
            tweet,
            COUNT(like_id) AS likes,
            (SELECT 
                COUNT(reply)
                FROM reply INNER JOIN tweet ON reply.tweet_id=tweet.tweet_id
                WHERE 
                    tweet.user_id=${userId}
                GROUP BY 
                    tweet.tweet_id)AS replies,
            date_time AS dateTime
            
        FROM tweet INNER JOIN like ON like.tweet_id=tweet.tweet_id
        WHERE 
           tweet.user_id=${userId}

        GROUP BY 
            tweet.tweet_id 
             
        

            ;`;
    const result = await db.all(getTweetQuery);
    response.send(result);
  } catch (e) {
    console.log(`Get tweet Error:${e.message}`);
  }
});

//add details on tweet table API - 10
app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const addQuery = `
        INSERT INTO 
            tweet(tweet)
        VALUES (
            '${tweet}'
        );`;
  await db.run(addQuery);
  response.send("Created a Tweet");
});

//delect only can user tweet API -11
app.delete("/tweets/:tweetId", authentication, async (request, response) => {
  const { tweetId } = request.params;

  try {
    const { userId } = request;
    const getTweetId = `
            SELECT * 
            FROM  tweet
            WHERE 
                user_id=${userId};
         `;
    const [check] = await db.all(getTweetId);
    const checkID = check.tweet_id;

    if (tweetId == checkID) {
      const deleteQuery = `
            DELETE  
                FROM tweet 
            WHERE  
                tweet_id=${tweetId};`;
      await db.run(deleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (e) {
    console.log(`Getting tweet Id Error:${e.message}`);
  }
});

module.exports = app;
