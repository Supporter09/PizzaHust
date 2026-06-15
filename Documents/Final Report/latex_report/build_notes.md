# PizzaHust LaTeX Build Notes

Run the commands from the SE_REPORT workspace root unless a step states otherwise.

## 1. Export one Mermaid diagram

The Mermaid CLI command pattern is:

```bash
mmdc -i latex_report/mermaid_sources/system_architecture.mmd \
     -o latex_report/figures/system_architecture.pdf \
     -b white
```

The `.mmd` files are source files. They must be exported to PDF before LaTeX compilation because
the section files reference PDFs under `latex_report/figures/`.

## 2. Mermaid sources copied

- `component_backend.mmd`
- `component_frontend.mmd`
- `database_catalog_options.mmd`
- `database_combos.mmd`
- `database_orders.mmd`
- `order_flow_implemented.mmd`
- `order_flow_delivery_flow.mmd`
- `system_architecture.mmd`
- `use_case_admin.mmd`
- `use_case_customer_account.mmd`
- `use_case_customer_ordering.mmd`
- `use_case_kitchen_delivery.mmd`

## 3. Export all Mermaid diagrams

```bash
mkdir -p latex_report/figures

for f in latex_report/mermaid_sources/*.mmd; do
  name=$(basename "$f" .mmd)
  mmdc -i "$f" -o "latex_report/figures/${name}.pdf" -b white
done
```

Expected PDF outputs:

- `latex_report/figures/component_backend.pdf`
- `latex_report/figures/component_frontend.pdf`
- `latex_report/figures/database_catalog_options.pdf`
- `latex_report/figures/database_combos.pdf`
- `latex_report/figures/database_orders.pdf`
- `latex_report/figures/order_flow_implemented.pdf`
- `latex_report/figures/order_flow_delivery_flow.pdf`
- `latex_report/figures/system_architecture.pdf`
- `latex_report/figures/use_case_admin.pdf`
- `latex_report/figures/use_case_customer_account.pdf`
- `latex_report/figures/use_case_customer_ordering.pdf`
- `latex_report/figures/use_case_kitchen_delivery.pdf`

## 4. Compile the LaTeX report

After exporting all diagrams, compile the root entrypoint with XeLaTeX. The report uses
`fontspec`, so `pdflatex` is not supported.

```bash
latexmk -xelatex -interaction=nonstopmode -halt-on-error -file-line-error main.tex
```

The expected report output is `main.pdf`.

If `latexmk` is unavailable but `xelatex` is installed, run `xelatex` from the workspace root at
least twice so the table of contents, figure list, table list, and references are updated:

```bash
xelatex -interaction=nonstopmode -halt-on-error main.tex
xelatex -interaction=nonstopmode -halt-on-error main.tex
```

## 5. Root compile entrypoint

Compile the report from the workspace root with `main.tex` as the entrypoint.
