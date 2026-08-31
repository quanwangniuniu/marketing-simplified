""" Tests for functions inside executors.py """

from django.test import SimpleTestCase

from .executors import _infer_value_type, _compute_column_stats

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
        self.assertIsNone(result["min_value"], "24.0")
        self.assertIsNone(result["max_value"], "42.0")
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
