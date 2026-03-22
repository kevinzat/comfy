import React from 'react';
import { DeclsAst } from '../lang/decls_ast';
import ProofSetup from './ProofSetup';
import Proof from './Proof';


interface AppState {
  problem: { decls: DeclsAst; givens: string[]; goal: string } | null;
}

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = { problem: null };
  }

  render() {
    if (this.state.problem === null) {
      return <ProofSetup
          onStart={(decls, givens, goal) =>
            this.setState({ problem: { decls, givens, goal } })} />;
    } else {
      return <Proof decls={this.state.problem.decls}
          givens={this.state.problem.givens}
          goal={this.state.problem.goal} />;
    }
  }
}
