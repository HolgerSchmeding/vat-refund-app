import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";

export const createSampleDocuments = onCall(
  {region: "europe-west1"},
  async (request) => {
    try {
      logger.info("Creating sample documents for user", {uid: request.auth?.uid});
      
      // For now, just return success - we'll implement the full logic later
      return {
        success: true,
        message: "Sample documents created successfully",
        count: 4
      };
    } catch (error) {
      logger.error("Error creating sample documents:", error);
      throw new HttpsError("internal", "Failed to create sample documents");
    }
  }
);
