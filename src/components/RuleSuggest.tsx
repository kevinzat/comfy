import React from 'react';
import { Match } from '../calc/calc_complete';


interface RuleSuggestProps {
  suggestions: Array<Match>
}

/** Displays a list of suggested ways to complete the current rule text. */
export class RuleSuggest extends React.Component<RuleSuggestProps, {}> {
  render() {
    const options: JSX.Element[] = [];
    for (let i = 0; i < this.props.suggestions.length; i++) {
      const desc = this.props.suggestions[i].description;
      const words: Array<string|JSX.Element> = [];
      for (let j = 0; j < desc.length; j++) {
        if (desc[j].bold) {
          words.push(<b key={j}>{desc[j].text}</b>);
        } else {
          words.push(desc[j].text);
        }
      }
      options.push(<div key={i}>{words}</div>);
    }

    return <div className="line-suggest">{options}</div>;
  }
}
