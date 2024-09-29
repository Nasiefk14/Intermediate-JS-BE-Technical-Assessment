# Intermediate-JS-BE-Technical-Assessment

1. Run `nvm use` to use correct node version - If not using nvm make sure to use a node version higher than 18.0.
2. Run `npm i` to install the needed npm packages
3. Create the .env file in the root of the project and add your firebase config and port to it(use .env.example as a reference) - These will be pulled into the index.ts file and be needed for the express server to run.
4. Run `npm run dev` to start the server locally and to use apis.
5. If you want to test the apis using postman go to step 6 if you want to test it in VSCode using Rest Client go to step 8 - For the Rest Client please install this package ```REST Client By Huachao Mao```
6. Open The Postman files from the postman folder in postman and start by create environment variables for PORT & POST_ID. Then add in the same PORT as in .env file from the previous step - Continue to step 7
7.  Start by creating a post by updating the body in the Create a post request and take your username you have given & the ID received in the request and add them to your blank POST_ID environment variable - After doing this you will be able to run all Post requests - Continue to step 9.
8. If you are using the Rest Client. Open the test.rest file in the tests folder Start by creating a post and using and using the post ID that is returned for your PostId for all the apis in the file(Use a find and replace to replace the {PORT} with your postId). You are able to run all tests going forward by using that PostId and the username you provided where applicable.
9. Once all post routes are complete move onto comment routes and start by creating a user and keeping that retruned ID that will go into your postman COMMENT_ID variable and replace your Comment_ID in test.rest file. After that step you should be able to test all comment routes.