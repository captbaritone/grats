import TweetModel from "../../../data/TweetModel";
import SkinResolver from "./SkinResolver";
import { graphqlType, graphqlField, Int } from "tsql";

@graphqlType
export default class TweetResolver {
  _model: TweetModel;
  constructor(model: TweetModel) {
    this._model = model;
  }

  @graphqlField
  url(): string {
    return this._model.getUrl();
  }

  @graphqlField
  likes(): Int {
    return this._model.getLikes();
  }

  @graphqlField
  retweets(count: number): number {
    return this._model.getRetweets();
  }
  async skin() {
    const skin = await this._model.getSkin();
    if (skin == null) {
      return null;
    }
    return SkinResolver.fromModel(skin);
  }
}
