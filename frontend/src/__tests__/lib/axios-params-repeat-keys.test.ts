import axios from "axios";

/**
 * Mirrors paramsSerializer in frontend/src/lib/api.ts — array params must use
 * repeated keys for Django QueryDict.getlist(), not status[]=...
 */
const PARAMS_SERIALIZER = { indexes: null } as const;

describe("axios paramsSerializer (Django-compatible arrays)", () => {
  it("serializes array params as repeated keys without brackets", () => {
    const client = axios.create({
      baseURL: "http://example.test",
      paramsSerializer: PARAMS_SERIALIZER,
    });

    const uri = client.getUri({
      url: "/api/tasks/",
      params: { status: ["DRAFT", "SUBMITTED"], project_id: 1 },
    });

    expect(uri).toContain("status=DRAFT");
    expect(uri).toContain("status=SUBMITTED");
    expect(uri).toContain("project_id=1");
    expect(uri).not.toMatch(/status%5B%5D=/);
  });
});
