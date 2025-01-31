import type { XYSeries, IXYSeriesDataItem } from "../../xy/series/XYSeries";
import type { StockLegend } from "../StockLegend";
import type { StockChart } from "../StockChart";
import type { DataItem } from "../../../core/render/Component";
import type { Color } from "../../../core/util/Color";

import { Container, IContainerSettings, IContainerPrivate, IContainerEvents } from "../../../core/render/Container";
import { LineSeries } from "../../xy/series/LineSeries";
import { BaseColumnSeries } from "../../xy/series/BaseColumnSeries";
import { MultiDisposer } from "../../../core/util/Disposer";

import * as $array from "../../../core/util/Array";

export interface IIndicatorEditableSetting {
	/**
	 * @todo review
	 */	
	key: string;
	/**
	 * @todo review
	 */	
	name: string;
	/**
	 * @todo review
	 */	
	type: "color" | "number" | "dropdown" | "checkbox";
	/**
	 * @todo review
	 */	
	options?: Array<string | { value: number | string, text: string }>;
}

export interface IIndicatorSettings extends IContainerSettings {
	/**
	 * @todo review
	 */	
	stockChart: StockChart;
	/**
	 * @todo review
	 */	
	stockSeries: XYSeries;
	/**
	 * @todo review
	 */	
	volumeSeries?: XYSeries;
	/**
	 * @todo review
	 */	
	legend?: StockLegend;
	/**
	 * @todo review
	 */
	period?: number;
	/**
	 * @todo review
	 */	
	field?: "open" | "close" | "low" | "high" | "hl/2" | "hlc/3" | "hlcc/4" | "ohlc/4";
	/**
	 * @todo review
	 */	
	name?: string;
	/**
	 * @todo review
	 */	
	shortName?: string;
	/**
	 * @todo review
	 */	
	seriesColor?: Color;
}

export interface IIndicatorPrivate extends IContainerPrivate {
}

export interface IIndicatorEvents extends IContainerEvents {

}

/**
 * Base class for [[StockChart]] indicators.
 *
 * @see {@link https://www.amcharts.com/docs/v5/charts/stock/indicators/} for more info
 */
export abstract class Indicator extends Container {
	public static className: string = "Indicator";
	public static classNames: Array<string> = Container.classNames.concat([Indicator.className]);

	declare public _settings: IIndicatorSettings;
	declare public _privateSettings: IIndicatorPrivate;
	declare public _events: IIndicatorEvents;

	public _editableSettings: IIndicatorEditableSetting[] = [];

	public series!: XYSeries;

	protected _dataDirty = false;

	protected _afterNew() {
		super._afterNew();
		this.set("position", "absolute");
	}

	protected _sDP?: MultiDisposer;
	protected _vDP?: MultiDisposer;

	public _prepareChildren() {
		super._prepareChildren();

		if (this.isDirty("stockSeries") || this.isDirty("volumeSeries")) {
			this._dataDirty = true;

			const stockSeries = this.get("stockSeries");
			const previousS = this._prevSettings.stockSeries;
			if (previousS && this._sDP) {
				this._sDP.dispose();
			}
			if (stockSeries) {
				this._sDP = new MultiDisposer([
					stockSeries.events.on("datavalidated", () => {
						this.markDataDirty();
					}),
					stockSeries.events.on("datasetchanged", () => {
						this.markDataDirty();
					})
				])
			}

			const previousV = this._prevSettings.volumeSeries;
			if (previousV && this._vDP) {
				this._vDP.dispose();
			}
			const volumeSeries = this.get("volumeSeries");
			if (volumeSeries) {
				this._vDP = new MultiDisposer([
					volumeSeries.events.on("datavalidated", () => {
						this.markDataDirty();
					}),
					volumeSeries.events.on("datasetchanged", () => {
						this.markDataDirty();
					})
				])
			}
		}

		if (this.isDirty("field")) {
			if (this.get("field")) {
				this._dataDirty = true;
			}
		}

		if (this.isDirty("period")) {
			this._dataDirty = true;
			this.setCustomData("period", this.get("period"));
		}

		if (this._dataDirty) {
			this.prepareData();
			this._dataDirty = false;
		}
	}

	protected markDataDirty() {
		this._dataDirty = true;
		this.markDirty();
	}

	public _updateChildren() {
		super._updateChildren();

		if (this.isDirty("seriesColor")) {
			this._updateSeriesColor(this.series, this.get("seriesColor"), "seriesColor");
		}

		this.setCustomData("period", this.get("period"));
		this.setCustomData("field", this.get("field"));
		this.setCustomData("name", this.get("name"));
		this.setCustomData("shortName", this.get("shortName"));

	}

	protected _dispose() {
		super._dispose();
		if (this._sDP) {
			this._sDP.dispose();
		}
		if (this._vDP) {
			this._vDP.dispose();
		}
	}

	protected _handleLegend(series: XYSeries) {
		const legend = this.get("legend");
		if (legend) {
			legend.data.push(series);

			var legendDataItem = legend.dataItems[legend.dataItems.length - 1];
			legendDataItem.get("marker").set("forceHidden", true);

			var closeButton = legendDataItem.get("closeButton");
			closeButton.set("forceHidden", false);
			closeButton.events.on("click", () => {
				this.dispose();
			})

			var settingsButton = legendDataItem.get("settingsButton");
			settingsButton.setPrivate("customData", this);
		}
	}

	protected _updateSeriesColor(series?: XYSeries, color?: Color, contextName?: string) {
		if (series) {
			series.set("stroke", color);
			series.set("fill", color);
			if (series instanceof LineSeries) {
				series.strokes.template.set("stroke", color);
			}

			if (series instanceof BaseColumnSeries) {
				series.columns.template.setAll({ stroke: color, fill: color });
			}

			if (contextName && color) {
				this.setCustomData(contextName, color.toCSSHex());
			}
		}
	}


	public setCustomData(name: string, value?: any) {
		const customData = this.series.getPrivate("customData");
		if (customData) {
			customData[name] = value;
		}
	}


	/**
	 * @ignore
	 */
	public prepareData() {

	}

	protected _getValue(dataItem: DataItem<IXYSeriesDataItem>): number | undefined {
		const field = this.get("field");

		let o = dataItem.get("openValueY") as number;
		let h = dataItem.get("highValueY") as number;
		let l = dataItem.get("lowValueY") as number;
		let c = dataItem.get("valueY") as number;

		switch (field) {
			case "close":
				return c;
				break;
			case "open":
				return o;
				break;
			case "high":
				return h;
				break;
			case "low":
				return l;
				break;
			case "hl/2":
				return (h + l) / 2;
				break;
			case "hlc/3":
				return (h + l + c) / 3;
				break;
			case "hlcc/4":
				return (h + l + c + c) / 4;
				break;
			case "ohlc/4":
				return (o + h + l + c) / 4;
				break;
		}
	}

	/**
	 * @ignore
	 */
	protected _getDataArray(dataItems: Array<DataItem<any>>): Array<any> {
		const data: Array<any> = [];
		$array.each(dataItems, (dataItem) => {
			data.push({ valueX: dataItem.get("valueX"), value_y: this._getValue(dataItem) });
		})
		return data;
	}

	/**
	 * @ignore
	 */
	protected _getTypicalPrice(dataItems: Array<DataItem<any>>): Array<any> {
		const data: Array<any> = [];
		$array.each(dataItems, (dataItem) => {
			data.push({ valueX: dataItem.get("valueX"), value_y: (dataItem.get("valueY", 0) + dataItem.get("highValueY", 0) + dataItem.get("lowValueY", 0)) / 2 });
		})
		return data;
	}

	protected _sma(data: Array<any>, period: number, field: string, toField: string) {
		let i = 0;
		let index = 0;
		let ma = 0;
		$array.each(data, (dataItem) => {
			let value = dataItem[field];
			if (value != null) {
				i++;
				ma += value / period;

				if (i >= period) {
					if (i > period) {
						let valueToRemove = data[index - period][field];
						if (valueToRemove != null) {
							ma -= valueToRemove / period;
						}
					}
					dataItem[toField] = ma;
				}
			}
			index++;
		})
	}

	protected _wma(data: Array<any>, period: number, field: string, toField: string) {
		let i = 0;
		let index = 0;
		let ma = 0;
		$array.each(data, (dataItem) => {
			let value = dataItem[field];
			if (value != null) {
				i++;
				if (i >= period) {
					let sum = 0;
					let m = 0;
					let count = 0;
					let k = 0
					for (let n = index; n >= 0; n--) {
						let pValue = data[n][field];

						if (pValue != null) {
							sum += pValue * (period - m);
							count += (period - m);
							k++;
						}
						m++;

						if (k == period) {
							break;
						}
					}

					ma = sum / count;
					dataItem[toField] = ma;
				}
			}
			index++;
		})
	}

	protected _ema(data: Array<any>, period: number, field: string, toField: string) {
		let i = 0;
		let ma = 0;
		let multiplier = 2 / (1 + period);
		$array.each(data, (dataItem) => {
			let value = dataItem[field];
			if (value != null) {
				i++;

				if (i > period) {
					ma = value * multiplier + ma * (1 - multiplier);
					dataItem[toField] = ma;
				}
				else {
					ma += value / period;
					if (i == period) {
						dataItem[toField] = ma;
					}
				}
			}
		})
	}

	protected _dema(data: Array<any>, period: number, field: string, toField: string) {
		let i = 0;
		let ema2 = 0;
		let multiplier = 2 / (1 + period);

		this._ema(data, period, field, "ema");

		$array.each(data, (dataItem) => {
			let ema = dataItem.ema;
			if (ema != null) {
				i++;
				if (i > period) {
					ema2 = ema * multiplier + ema2 * (1 - multiplier);
					dataItem[toField] = 2 * ema - ema2;
					dataItem.ema2 = ema2;
				}
				else {
					ema2 += ema / period;
					if (i == period) {
						dataItem[toField] = 2 * ema - ema2;
						dataItem.ema2 = ema2;
					}
				}
			}
		})
	}

	protected _tema(data: Array<any>, period: number, field: string, toField: string) {
		let i = 0;
		let ema3 = 0;
		let multiplier = 2 / (1 + period);

		this._dema(data, period, field, "dema");

		$array.each(data, (dataItem) => {
			let ema = dataItem.ema;
			let ema2 = dataItem.ema2;

			if (ema2 != null) {
				i++;
				if (i > period) {
					ema3 = ema2 * multiplier + ema3 * (1 - multiplier);
					dataItem[toField] = 3 * ema - 3 * ema2 + ema3;
				}
				else {
					ema3 += ema2 / period;
					if (i == period) {
						dataItem[toField] = 3 * ema - 3 * ema2 + ema3;
					}
				}
			}
		})
	}
}