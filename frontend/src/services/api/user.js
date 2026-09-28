import { apiRequest } from "./client";

export function getUserById(userId) {
  return apiRequest(`/api/v1/users/${userId}`, {
    method: "GET",
  });
}