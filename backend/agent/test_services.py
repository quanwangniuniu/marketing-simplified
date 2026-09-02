"""Focused unit tests for the helper functions in agent/services.py.

External systems are replaced at their boundaries.  In particular, these tests
never make real Anthropic or Gemini requests.
"""
import json
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from . import services
from .models import AgentSession


class AgentStatusMessageTests(SimpleTestCase):
    @patch("agent.services.AgentMessage.objects.create")
    def test_non_model_session_is_ignored(self, mock_create):
        result = services._create_agent_status_message(
            SimpleNamespace(id="stub-session"),
            "Working",
            event_type="analysis_started",
        )

        self.assertIsNone(result)
        mock_create.assert_not_called()

    @patch("agent.services.AgentMessage.objects.create")
    def test_model_session_creates_assistant_message_with_metadata(self, mock_create):
        session = AgentSession(id="11111111-1111-1111-1111-111111111111")
        created_message = object()
        mock_create.return_value = created_message

        result = services._create_agent_status_message(
            session,
            "Board queued",
            event_type="miro_queued",
            message_type="status",
            workflow_run_id="run-7",
        )

        self.assertIs(result, created_message)
        mock_create.assert_called_once_with(
            session=session,
            role="assistant",
            content="Board queued",
            message_type="status",
            metadata={"event_type": "miro_queued", "workflow_run_id": "run-7"},
        )


class AnthropicClientTests(SimpleTestCase):
    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_missing_api_key_returns_none(self):
        self.assertIsNone(services._get_llm_client())

    @patch("anthropic.Anthropic")
    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-anthropic-key"})
    def test_configured_api_key_builds_anthropic_client(self, mock_anthropic):
        expected_client = object()
        mock_anthropic.return_value = expected_client

        result = services._get_llm_client()

        self.assertIs(result, expected_client)
        mock_anthropic.assert_called_once_with(api_key="test-anthropic-key")

    def test_call_llm_parses_anthropic_json_response(self):
        client = MagicMock()
        client.messages.create.return_value = SimpleNamespace(
            content=[SimpleNamespace(text=json.dumps({"anomalies": [], "recommended_tasks": []}))]
        )
        spreadsheet_data = {
            "name": "Campaign report",
            "sheets": [{"name": "Ads", "columns": ["Spend"], "rows": [{"Spend": 25}]}],
        }

        result = services._call_llm(client, spreadsheet_data)

        self.assertEqual(result, {"anomalies": [], "recommended_tasks": []})
        call = client.messages.create.call_args.kwargs
        self.assertEqual(call["model"], "claude-sonnet-4-20250514")
        self.assertEqual(call["max_tokens"], 2000)
        self.assertIn('"Spend": 25', call["messages"][0]["content"])


class SpreadsheetExtractionTests(SimpleTestCase):
    @patch("agent.services.Cell.objects.filter")
    def test_extract_spreadsheet_data_uses_supported_cell_values(self, mock_cell_filter):
        spreadsheet = MagicMock()
        spreadsheet.name = "Quarterly report"
        sheet = MagicMock()
        sheet.name = "Performance"
        spreadsheet.sheets.filter.return_value.order_by.return_value = [sheet]
        sheet.columns.filter.return_value.order_by.return_value.values_list.return_value = [
            "Computed number",
            "Computed text",
            "String",
            "Number",
            "Boolean",
            "Detached",
        ]

        first_row = object()
        empty_row = object()
        ordered_rows = MagicMock()
        ordered_rows.__getitem__.return_value = [first_row, empty_row]
        sheet.rows.filter.return_value.order_by.return_value = ordered_rows

        def cell(column_name=None, **values):
            defaults = {
                "computed_type": "",
                "computed_number": None,
                "computed_string": "",
                "string_value": "",
                "number_value": None,
                "boolean_value": None,
                "column_id": 99,
            }
            defaults.update(values)
            defaults["column"] = (
                SimpleNamespace(name=column_name) if column_name is not None else None
            )
            return SimpleNamespace(**defaults)

        first_cells = [
            cell("Computed number", computed_type="NUMBER", computed_number=Decimal("12.5")),
            cell("Computed text", computed_string="formula result"),
            cell("String", string_value="plain text"),
            cell("Number", number_value=Decimal("7.25")),
            cell("Boolean", boolean_value=False),
            cell(None, boolean_value=True, column_id=99),
        ]
        empty_cells = [cell("String")]

        def cell_query(*, row, **_kwargs):
            query = MagicMock()
            query.select_related.return_value.order_by.return_value = (
                first_cells if row is first_row else empty_cells
            )
            return query

        mock_cell_filter.side_effect = cell_query

        result = services._extract_spreadsheet_data(spreadsheet)

        self.assertEqual(
            result,
            {
                "name": "Quarterly report",
                "sheets": [
                    {
                        "name": "Performance",
                        "columns": [
                            "Computed number",
                            "Computed text",
                            "String",
                            "Number",
                            "Boolean",
                            "Detached",
                        ],
                        "rows": [
                            {
                                "Computed number": 12.5,
                                "Computed text": "formula result",
                                "String": "plain text",
                                "Number": 7.25,
                                "Boolean": False,
                                "col_99": True,
                            }
                        ],
                    }
                ],
            },
        )


class AnalysisInputHelperTests(SimpleTestCase):
    def test_build_criteria_text_formats_rules_goals_and_key_columns(self):
        criteria_text, key_columns = services._build_criteria_text(
            {
                "schema_type": "paid_social",
                "key_columns": ["Spend", "ROAS"],
                "criteria": [
                    {"column": "Spend", "anomaly_rule": "must be positive"},
                    {"column": "Notes", "anomaly_rule": ""},
                ],
                "analysis_goals": ["Find wasted spend", "Protect strong campaigns"],
            }
        )

        self.assertEqual(key_columns, ["Spend", "ROAS"])
        self.assertEqual(
            criteria_text,
            "Dataset type: paid_social\n"
            "- Spend: must be positive\n"
            "Analysis goals:\n"
            "  * Find wasted spend\n"
            "  * Protect strong campaigns",
        )

    def test_build_criteria_text_accepts_json_and_rejects_invalid_values(self):
        valid = json.dumps({"schema_type": "sales", "key_columns": ["Revenue"]})

        self.assertEqual(
            services._build_criteria_text(valid),
            ("Dataset type: sales", ["Revenue"]),
        )
        self.assertEqual(services._build_criteria_text("not-json"), ("", []))

    def test_resolve_analysis_columns_handles_direct_and_fallback_paths(self):
        cases = [
            ((["Spend"], [], None), ["Spend"]),
            (([], ["Spend", "ROAS"], None), ["Spend", "ROAS"]),
            ((["Spend"], ["Spend", "ROAS"], None), ["Spend"]),
            ((["Unknown"], ["Spend", "ROAS"], None), ["Spend", "ROAS"]),
            ((["Amount Spent"], ["amount_spent"], {"amount spent": "amount_spent"}), ["amount_spent"]),
            ((["Campaign (ID)"], ["campaign_id"], {}), ["campaign_id"]),
            ((["Unknown"], ["Spend"], {"Other": "other"}), ["Spend"]),
        ]

        for arguments, expected in cases:
            with self.subTest(arguments=arguments):
                self.assertEqual(services._resolve_analysis_columns(*arguments), expected)


class ChatOutputNormalizationTests(SimpleTestCase):
    def test_coerce_json_parses_json_but_preserves_other_values(self):
        self.assertEqual(services._coerce_json('{"answer": 3}'), {"answer": 3})
        self.assertEqual(services._coerce_json("not-json"), "not-json")
        marker = object()
        self.assertIs(services._coerce_json(marker), marker)

    def test_normalize_chat_output_cleans_valid_structured_response(self):
        output = {
            "status": "needs_clarification",
            "text": "  Which Alex?  ",
            "forwards": json.dumps(
                [
                    {"username": "  alex1  ", "content": "  Please review  "},
                    {"username": "", "content": "ignored"},
                    {"username": "alex2", "content": ""},
                    "not-a-dictionary",
                ]
            ),
        }

        result = services._normalize_llm_chat_output(output)

        self.assertEqual(
            result,
            {
                "status": "needs_clarification",
                "text": "Which Alex?",
                "forwards": [{"username": "alex1", "content": "Please review"}],
            },
        )

    def test_normalize_chat_output_uses_fallback_text_and_safe_defaults(self):
        result = services._normalize_llm_chat_output(
            {"status": "invented", "text": "", "answer": "  Final answer  ", "forwards": {}}
        )

        self.assertEqual(
            result,
            {"status": "completed", "text": "Final answer", "forwards": []},
        )

    def test_normalize_chat_output_accepts_plain_text_and_rejects_empty_output(self):
        self.assertEqual(
            services._normalize_llm_chat_output("  Plain reply  "),
            {"status": "completed", "text": "Plain reply", "forwards": []},
        )
        self.assertIsNone(services._normalize_llm_chat_output({"text": ""}))
        self.assertIsNone(services._normalize_llm_chat_output("   "))


class GeminiChatBoundaryTests(SimpleTestCase):
    @patch("agent.gemini_client.call_gemini_json")
    def test_call_gemini_chat_normalizes_mocked_response(self, mock_call_gemini):
        mock_call_gemini.return_value = {
            "status": "completed",
            "text": "Budget is stable.",
            "forwards": [],
        }

        result = services._call_gemini_chat(
            "[user]: Summarize it",
            user_id="user-1",
            analysis_result={"anomalies": []},
            project_members=[{"username": "alex"}],
            current_username="alex",
        )

        self.assertEqual(
            result,
            {"status": "completed", "text": "Budget is stable.", "forwards": []},
        )
        prompt = mock_call_gemini.call_args.kwargs["user_prompt"]
        self.assertIn("[user]: Summarize it", prompt)
        self.assertIn('"username": "alex"', prompt)

    @patch("agent.llm_client.call_llm")
    def test_call_gemini_chat_uses_unified_client_for_agent_session(self, mock_call_llm):
        mock_call_llm.return_value = {
            "text": json.dumps(
                {"status": "completed", "text": "Done", "forwards": []}
            ),
            "usage": {"input": 10, "output": 5},
        }
        session = object()

        result = services._call_gemini_chat("history", agent_session=session)

        self.assertEqual(result["text"], "Done")
        self.assertIs(mock_call_llm.call_args.kwargs["agent_session"], session)
        self.assertEqual(mock_call_llm.call_args.kwargs["call_purpose"], "follow_up_chat")

    @patch("agent.gemini_client.call_gemini_json", side_effect=RuntimeError("offline"))
    def test_call_gemini_chat_converts_provider_failure_to_runtime_error(self, _mock_call):
        with self.assertRaisesRegex(RuntimeError, "Gemini chat failed: offline"):
            services._call_gemini_chat("history")

    @patch("agent.gemini_client.call_gemini_json", return_value={"text": ""})
    def test_call_gemini_chat_rejects_unexpected_output(self, _mock_call):
        with self.assertRaisesRegex(RuntimeError, "unexpected output format"):
            services._call_gemini_chat("history")


class ProjectMemberSerializationTests(SimpleTestCase):
    @patch("core.models.ProjectMember.objects.filter")
    def test_serialize_project_members_excludes_users_and_uses_name_fallbacks(self, mock_filter):
        full_name_user = SimpleNamespace(
            id=1,
            username="alex",
            email="alex@example.com",
            get_full_name=lambda: "Alex Smith",
        )
        username_user = SimpleNamespace(
            id=2,
            username="sam",
            email="sam@example.com",
            get_full_name=lambda: "",
        )
        members = [SimpleNamespace(user=full_name_user), SimpleNamespace(user=username_user)]
        query = mock_filter.return_value
        query.exclude.return_value.select_related.return_value = members

        result = services._serialize_project_members(
            project=object(),
            excluded_users=[SimpleNamespace(id=7), SimpleNamespace(id=None)],
        )

        self.assertEqual(
            result,
            [
                {"username": "alex", "email": "alex@example.com", "display_name": "Alex Smith"},
                {"username": "sam", "email": "sam@example.com", "display_name": "sam"},
            ],
        )
        self.assertEqual(query.exclude.call_args.kwargs, {"user_id__in": {7}})
