"""Tests for functions inside executors.py."""

from unittest.mock import patch

from django.test import SimpleTestCase

from .approval_gate import ExternalCommitResult
from .executors import CustomAPIExecutor, _compute_column_stats, _infer_value_type


class _StepStub:
    """Small stand-in for a workflow step with executor configuration."""

    def __init__(self, config=None):
        self.config = config or {}


class InferValueTypeTests(SimpleTestCase):
    def test_empty_list_defaults_to_string(self):
        values = []
        result = _infer_value_type(values)
        self.assertEqual(result, "string")

    def test_empty_markers_default_to_string(self):
        values = [None, "", "-"]
        result = _infer_value_type(values)
        self.assertEqual(result, "string")

    def test_numeric_values_are_inferred_as_number(self):
        values = ["10", "20.5", "1,000", "-10,000,000", ".245"]
        result = _infer_value_type(values)
        self.assertEqual(result, "number")

    def test_boolean_values_are_inferred_as_boolean(self):
        values = ["true", "false", "yes", "no"]
        result = _infer_value_type(values)
        self.assertEqual(result, "boolean")

    def test_text_values_are_inferred_as_string(self):
        values = ["alice", "bob", "maxwell", "ray"]
        result = _infer_value_type(values)
        self.assertEqual(result, "string")

    def test_exactly_80_percent_numeric_is_number(self):
        values = ["10", "20", "30", "40", "unknown"]
        result = _infer_value_type(values)
        self.assertEqual(result, "number")

    def test_less_than_80_percent_numeric_is_string(self):
        values = ["10", "20", "30", "apple", "pear"]
        result = _infer_value_type(values)
        self.assertEqual(result, "string")

    def test_zero_and_one_are_treated_as_boolean(self):
        values = ["1", "1", "0", "1", "0", "0"]
        result = _infer_value_type(values)
        self.assertEqual(result, "boolean")


class ComputeColumnStatsTests(SimpleTestCase):
    def test_empty_markers_are_counted_as_null(self):
        values = [None, "", "-"]
        result = _compute_column_stats(values, "string")
        self.assertEqual(result["null_count"], 3)
        self.assertEqual(result["unique_count"], 0)
        self.assertIsNone(result["min_value"])
        self.assertIsNone(result["max_value"])
        self.assertEqual(result["sample_values"], [])

    def test_empty_markers_do_not_affect_number(self):
        values = [None, "", "-", "42", "24"]
        result = _compute_column_stats(values, "number")
        self.assertEqual(result["null_count"], 3)
        self.assertEqual(result["unique_count"], 2)
        self.assertEqual(result["min_value"], "24.0")
        self.assertEqual(result["max_value"], "42.0")
        self.assertCountEqual(result["sample_values"], ["42", "24"])

    def test_duplicate_text_are_counted_once(self):
        values = ["Alice", "Alice", "Bob"]
        result = _compute_column_stats(values, "string")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 2)
        self.assertIsNone(result["min_value"])
        self.assertIsNone(result["max_value"])
        self.assertCountEqual(result["sample_values"], ["Alice", "Bob"])

    def test_numeric_stats(self):
        values = ["10", "20", "5", "30"]
        result = _compute_column_stats(values, "number")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 4)
        self.assertEqual(result["min_value"], "5.0")
        self.assertEqual(result["max_value"], "30.0")
        self.assertCountEqual(result["sample_values"], ["30", "5", "20", "10"])

    def test_comma_numbers(self):
        values = ["10,000", "2,000", "34,234", "5"]
        result = _compute_column_stats(values, "number")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 4)
        self.assertEqual(result["min_value"], "5.0")
        self.assertEqual(result["max_value"], "34234.0")
        self.assertCountEqual(result["sample_values"], ["34,234", "5", "10,000", "2,000"])

    def test_numeric_column_in_string_type(self):
        values = ["10,000", "2,000", "34,234", "5"]
        result = _compute_column_stats(values, "string")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 4)
        self.assertIsNone(result["min_value"])
        self.assertIsNone(result["max_value"])
        self.assertCountEqual(result["sample_values"], ["34,234", "5", "10,000", "2,000"])

    def test_invalid_numbers(self):
        values = ["25", "invalid"]
        result = _compute_column_stats(values, "number")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 2)
        self.assertIsNone(result["min_value"])
        self.assertIsNone(result["max_value"])
        self.assertCountEqual(result["sample_values"], ["25", "invalid"])

    def test_string_conversion(self):
        values = [1, "1"]
        result = _compute_column_stats(values, "string")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 1)
        self.assertIsNone(result["min_value"])
        self.assertIsNone(result["max_value"])
        self.assertCountEqual(result["sample_values"], ["1"])

    def test_sample_limit(self):
        values = ["A", "B", "C", "D", "E", "F", "G", "H"]
        result = _compute_column_stats(values, "string")
        self.assertEqual(result["null_count"], 0)
        self.assertEqual(result["unique_count"], 8)
        self.assertIsNone(result["min_value"])
        self.assertIsNone(result["max_value"])
        self.assertEqual(len(result["sample_values"]), 5)
        self.assertTrue(set(result["sample_values"]).issubset(set(values)))


class CustomAPIExecutorTests(SimpleTestCase):
    # The executor imports this function when execute() runs. Patching it here
    # keeps the executor real while preventing database work or an HTTP request
    @patch("agent.approval_gate.request_external_commit", autospec=True)
    def test_success_serializes_input_and_uses_approval_gate_output(
        self, mock_request_commit
    ):
        input_data = {"campaign_id": 123}
        gate_events = [
            {
                "type": "text",
                "content": "Custom API call completed.",
            }
        ]
        gate_output = {
            "campaign_id": 123,
            "api_response": {"ok": True},
        }
        # A real result object makes the mock follow the approval gate's actual
        # return structure instead of silently inventing attributes as needed
        mock_request_commit.return_value = ExternalCommitResult(
            paused=False,
            sse_events=gate_events,
            pending_id=None,
            output_data=gate_output,
            workflow_run_patch={},
        )
        step = _StepStub(
            {
                "method": "post",
                "url": "https://example.test/webhook",
                "headers": {"Authorization": "Bearer test-token"},
                "body_template": "__input__",
                "timeout": 5,
            }
        )
        workflow_run = object()
        orchestrator = object()
        step_execution = object()
        executor = CustomAPIExecutor(
            step=step,
            workflow_run=workflow_run,
            orchestrator=orchestrator,
        )
        # The workflow engine normally attaches this record just before execute()
        # This unit test supplies an empty object because no database record is needed
        executor.step_execution = step_execution

        result = executor.execute(input_data)

        self.assertTrue(result.success)
        self.assertEqual(result.output_data, gate_output)
        self.assertEqual(result.sse_events, gate_events)
        self.assertFalse(result.pause_external_approval)
        # This checks the contract between the executor and approval gate
        # including method normalization and JSON serialization of the input
        mock_request_commit.assert_called_once_with(
            orchestrator=orchestrator,
            workflow_run=workflow_run,
            step_execution=step_execution,
            kind="custom_api",
            draft={
                "method": "POST",
                "url": "https://example.test/webhook",
                "headers": {"Authorization": "Bearer test-token"},
                "body": '{"campaign_id": 123}',
            },
            commit_context={
                "method": "POST",
                "url": "https://example.test/webhook",
                "headers": {"Authorization": "Bearer test-token"},
                "timeout": 5,
                "merge_output": {"campaign_id": 123},
            },
        )

    @patch("agent.approval_gate.request_external_commit", autospec=True)
    def test_missing_url_returns_failure_without_calling_gate(
        self, mock_request_commit
    ):
        executor = CustomAPIExecutor(
            step=_StepStub({"method": "POST"}),
            workflow_run=object(),
            orchestrator=object(),
        )

        result = executor.execute({"campaign_id": 123})

        self.assertFalse(result.success)
        self.assertEqual(result.error, "No URL configured for custom API step")
        mock_request_commit.assert_not_called()

    @patch("agent.approval_gate.request_external_commit", autospec=True)
    def test_raw_body_template_is_passed_unchanged(self, mock_request_commit):
        mock_request_commit.return_value = ExternalCommitResult(
            paused=False,
            sse_events=[],
            pending_id=None,
            output_data={"status": "sent"},
            workflow_run_patch={},
        )
        executor = CustomAPIExecutor(
            step=_StepStub(
                {
                    "url": "https://example.test/webhook",
                    "body_template": '{"fixed": true}',
                }
            ),
            workflow_run=object(),
            orchestrator=object(),
        )

        result = executor.execute({"campaign_id": 123})

        self.assertTrue(result.success)
        self.assertEqual(result.output_data, {"status": "sent"})
        # call_args records the keyword arguments received by the patched gate
        self.assertEqual(
            mock_request_commit.call_args.kwargs["draft"]["body"],
            '{"fixed": true}',
        )

    @patch("agent.approval_gate.request_external_commit", autospec=True)
    def test_defaults_are_used_and_missing_gate_output_falls_back_to_input(
        self, mock_request_commit
    ):
        input_data = {"campaign_id": 123}
        mock_request_commit.return_value = ExternalCommitResult(
            paused=False,
            sse_events=[],
            pending_id=None,
            output_data=None,
            workflow_run_patch={},
        )
        executor = CustomAPIExecutor(
            step=_StepStub({"url": "https://example.test/webhook"}),
            workflow_run=object(),
            orchestrator=object(),
        )

        result = executor.execute(input_data)

        self.assertTrue(result.success)
        self.assertEqual(result.output_data, input_data)
        # Equal contents but a different object proves the fallback is a copy
        # so top-level changes to the output cannot mutate the original dictionary
        self.assertIsNot(result.output_data, input_data)
        gate_arguments = mock_request_commit.call_args.kwargs
        self.assertEqual(
            gate_arguments["draft"],
            {
                "method": "POST",
                "url": "https://example.test/webhook",
                "headers": {},
                "body": None,
            },
        )
        self.assertEqual(gate_arguments["commit_context"]["timeout"], 30)

    @patch("agent.approval_gate.request_external_commit", autospec=True)
    def test_paused_gate_requests_external_approval(self, mock_request_commit):
        input_data = {"campaign_id": 123}
        gate_events = [
            {
                "type": "approval_request",
                "content": "Approval required.",
                "data": {"pending_id": "pending-123"},
            }
        ]
        mock_request_commit.return_value = ExternalCommitResult(
            paused=True,
            sse_events=gate_events,
            pending_id="pending-123",
            output_data=None,
            workflow_run_patch=None,
        )
        executor = CustomAPIExecutor(
            step=_StepStub({"url": "https://example.test/webhook"}),
            workflow_run=object(),
            orchestrator=object(),
        )

        result = executor.execute(input_data)

        self.assertTrue(result.success)
        self.assertIs(result.output_data, input_data)
        self.assertEqual(result.sse_events, gate_events)
        self.assertTrue(result.pause_external_approval)

    @patch("agent.approval_gate.request_external_commit", autospec=True)
    def test_gate_exception_is_converted_to_failed_result(
        self, mock_request_commit
    ):
        # side_effect makes the patched function raise when the executor calls it
        mock_request_commit.side_effect = RuntimeError("API service unavailable")
        executor = CustomAPIExecutor(
            step=_StepStub({"url": "https://example.test/webhook"}),
            workflow_run=object(),
            orchestrator=object(),
        )

        result = executor.execute({"campaign_id": 123})

        self.assertFalse(result.success)
        self.assertEqual(result.error, "API service unavailable")
