export interface AdminGraphQLClient {
  graphql(
    query: string,
    options?: { variables?: Record<string, unknown> },
  ): Promise<Response>;
}

export interface GraphQLUserError {
  field?: string[];
  message: string;
  code?: string;
}

export interface GraphQLRequestError {
  message: string;
}
